// ============================================================
// js/db.js
// Capa de Acceso a Datos (Data Access Layer / DAL)
//
// REGLA: Este archivo es el ÚNICO que habla con Supabase.
//        El resto de la app usa estas funciones, no llama
//        a window.sb directamente.
//
// POR QUÉ usamos window.sb en lugar de solo sb:
//   Con scripts cargados via <script defer>, cada archivo tiene
//   su propio momento de ejecución. Si usamos solo "sb" (sin
//   el prefijo "window."), en Firefox o en contextos de
//   strict mode puede generar "sb is not defined" si el orden
//   de inicialización no es perfecto.
//   Usar window.sb hace la referencia explícita y segura.
// ============================================================

// ─────────────────────────────────────────────
// Helper privado: obtener la sucursal activa de forma segura
// Primero intenta la variable global, luego localStorage como fallback
// ─────────────────────────────────────────────
function _getSucursal() {
  if (typeof currentSucursal !== 'undefined' && currentSucursal && currentSucursal.id) {
    return currentSucursal;
  }
  try {
    var raw = localStorage.getItem('pos_sucursal');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignora */ }
  return null;
}

// ─────────────────────────────────────────────
// Helper privado: verificar que window.sb esté disponible
// Devuelve true si está OK, false si hay problema
// ─────────────────────────────────────────────
function _checkSb() {
  if (!window.sb || typeof window.sb.from !== 'function') {
    console.error('[DB] window.sb no está inicializado. Verificar supabase-client.js.');
    return false;
  }
  return true;
}

// ============================================================
// CARGA INICIAL
// ============================================================

/**
 * loadInitialData()
 * Carga todos los datos necesarios desde Supabase al iniciar la app.
 * Se vuelve a llamar despues de operaciones importantes para refrescar el estado.
 *
 * Retorna: true si cargó bien, false si hubo error.
 */
async function loadInitialData() {
  if (!_checkSb()) return false;

  try {
    // 1. Sucursal activa
    var sucResult = await window.sb.from('sucursales').select('*').limit(1);
    if (sucResult.error) {
      console.error('[DB] Error cargando sucursal:', sucResult.error.message);
      return false;
    }

    // Asignar a la variable global declarada en app.js
    currentSucursal = (sucResult.data && sucResult.data[0]) ? sucResult.data[0] : null;

    if (!currentSucursal) {
      console.warn('[DB] No hay sucursales en la base de datos. Usar openPopup("sucursal") para crear una.');
      return false;
    }

    var sid = currentSucursal.id;

    // 2. Productos
    var prodResult = await window.sb.from('productos').select('*').eq('sucursal_id', sid);
    products = prodResult.data || [];

    // 3. Proveedores
    var provResult = await window.sb.from('proveedores').select('*').eq('sucursal_id', sid);
    suppliers = provResult.data || [];

    // 4. Compras con detalle de proveedor
    var compResult = await window.sb
      .from('compras')
      .select('*, proveedores(name), detalle_compras(*)')
      .eq('sucursal_id', sid);

    purchases = (compResult.data || []).map(function (c) {
      return {
        date: new Date(c.date).toLocaleDateString('es-AR'),
        prov: (c.proveedores && c.proveedores.name) ? c.proveedores.name : 'Sin proveedor',
        prod: 'Varios',
        qty:  (c.detalle_compras || []).reduce(function (sum, d) { return sum + d.qty; }, 0),
        cost: c.total
      };
    });

    // 5. Configuración (IVA y apertura de caja)
    var cfgResult = await window.sb.from('configuracion').select('*').eq('sucursal_id', sid);
    var cfg = cfgResult.data || [];

    var ivaRow     = cfg.find(function (c) { return c.key === 'iva'; });
    var cashRow    = cfg.find(function (c) { return c.key === 'opening_cash'; });
    ivaConfig   = parseFloat((ivaRow   && ivaRow.value)  ? ivaRow.value  : 21);
    openingCash = parseFloat((cashRow  && cashRow.value)  ? cashRow.value : 0);

    // 6. Métodos de pago / descuentos
    var pmResult = await window.sb.from('metodos_pago').select('*').eq('sucursal_id', sid);
    paymentRules = pmResult.data || [];

    // 7. Promociones
    var promoResult = await window.sb.from('promociones').select('*').eq('sucursal_id', sid);
    promos = promoResult.data || [];

    // 8. Ventas con detalle de items (para historial y análisis IA)
    var salesResult = await window.sb
      .from('ventas')
      .select('*, detalle_ventas(qty, price, productos(id, name, code))')
      .eq('sucursal_id', sid)
      .order('date', { ascending: false });

    transactions = (salesResult.data || []).map(function (s) {
      return {
        id:      s.id,
        code:    s.code,
        dateRaw: new Date(s.date),
        date:    new Date(s.date).toLocaleString('es-AR'),
        method:  s.method,
        total:   s.total,
        items:   (s.detalle_ventas || []).map(function (d) {
          return {
            productName: (d.productos && d.productos.name) ? d.productos.name : 'Producto',
            productCode: (d.productos && d.productos.code) ? d.productos.code : '',
            qty:   d.qty,
            price: d.price
          };
        })
      };
    });

    console.log('[DB] Datos cargados: ' + products.length + ' productos, ' + transactions.length + ' ventas.');
    return true;

  } catch (e) {
    console.error('[DB] Error inesperado en loadInitialData:', e);
    return false;
  }
}

// ============================================================
// PRODUCTOS
// ============================================================

/**
 * dbAddProduct(code, name, price, stock, image)
 * Inserta un producto nuevo en la sucursal activa.
 * Retorna: error (null si OK)
 */
async function dbAddProduct(code, name, price, stock, image) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('productos').insert([{
    code:        code,
    name:        name,
    price:       price,
    stock:       stock,
    image:       image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
    sucursal_id: s.id
  }]);
  return result.error;
}

/**
 * dbDeleteProduct(productId)
 * Elimina un producto por su ID (UUID de Supabase).
 * Retorna: error (null si OK)
 */
async function dbDeleteProduct(productId) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var result = await window.sb.from('productos').delete().eq('id', productId);
  return result.error;
}

/**
 * dbUpdateStock(productId, newStock)
 * Actualiza el stock de un producto.
 * Retorna: error (null si OK)
 */
async function dbUpdateStock(productId, newStock) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var result = await window.sb.from('productos').update({ stock: newStock }).eq('id', productId);
  return result.error;
}

// ============================================================
// VENTAS
// ============================================================

/**
 * dbCreateSale(code, total, method)
 * Registra una venta nueva.
 * Retorna: { data, error }
 */
async function dbCreateSale(code, total, method) {
  if (!_checkSb()) return { data: null, error: { message: 'Supabase no disponible' } };
  var s = _getSucursal();
  if (!s) return { data: null, error: { message: 'Sin sucursal activa' } };

  var result = await window.sb.from('ventas').insert([{
    code:        code,
    total:       total,
    method:      method,
    sucursal_id: s.id
    // user_id: null — sin auth de Supabase, dejamos null
  }]).select();
  return { data: result.data, error: result.error };
}

/**
 * dbCreateSaleDetails(ventaId, cartItems)
 * Inserta los items de una venta.
 * Retorna: error (null si OK)
 */
async function dbCreateSaleDetails(ventaId, cartItems) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };

  var detalles = cartItems.map(function (item) {
    return {
      venta_id:   ventaId,
      product_id: item.id,
      qty:        item.qty,
      price:      item.price
    };
  });

  var result = await window.sb.from('detalle_ventas').insert(detalles);
  return result.error;
}

/**
 * dbClearSales()
 * Borra TODAS las ventas de la sucursal (acción irreversible).
 * Retorna: error (null si OK)
 */
async function dbClearSales() {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('ventas').delete().eq('sucursal_id', s.id);
  return result.error;
}

/**
 * dbVoidSale(ventaId)
 * Anula (borra) una venta específica por ID.
 * Retorna: error (null si OK)
 */
async function dbVoidSale(ventaId) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var result = await window.sb.from('ventas').delete().eq('id', ventaId);
  return result.error;
}

// ============================================================
// PROVEEDORES
// ============================================================

/**
 * dbAddSupplier(name, contact)
 * Agrega un proveedor a la sucursal activa.
 * Retorna: error (null si OK)
 */
async function dbAddSupplier(name, contact) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('proveedores').insert([{
    name:        name,
    contact:     contact,
    sucursal_id: s.id
  }]);
  return result.error;
}

// ============================================================
// COMPRAS / INGRESO DE STOCK
// ============================================================

/**
 * dbCreatePurchase(supplierId, total)
 * Registra una compra (cabecera).
 * Retorna: { data, error }
 */
async function dbCreatePurchase(supplierId, total) {
  if (!_checkSb()) return { data: null, error: { message: 'Supabase no disponible' } };
  var s = _getSucursal();
  if (!s) return { data: null, error: { message: 'Sin sucursal activa' } };

  var result = await window.sb.from('compras').insert([{
    supplier_id: supplierId,
    total:       total,
    sucursal_id: s.id
  }]).select();
  return { data: result.data, error: result.error };
}

/**
 * dbCreatePurchaseDetail(compraId, productId, qty, cost)
 * Registra el detalle de una compra.
 * Retorna: error (null si OK)
 */
async function dbCreatePurchaseDetail(compraId, productId, qty, cost) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };

  var result = await window.sb.from('detalle_compras').insert([{
    compra_id:  compraId,
    product_id: productId,
    qty:        qty,
    cost:       cost
  }]);
  return result.error;
}

// ============================================================
// CAJA
// ============================================================

/**
 * dbRegisterCashMovement(type, amount, reason)
 * Registra un movimiento de caja (ingreso o egreso).
 * Retorna: error (null si OK)
 */
async function dbRegisterCashMovement(type, amount, reason) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('caja_movimientos').insert([{
    type:        type,
    amount:      amount,
    reason:      reason,
    user_id:     null, // sin auth de Supabase
    sucursal_id: s.id
  }]);
  return result.error;
}

/**
 * dbSetOpeningCash(value)
 * Guarda o actualiza el monto de apertura de caja en configuracion.
 * Retorna: error (null si OK)
 */
async function dbSetOpeningCash(value) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('configuracion').upsert(
    { key: 'opening_cash', value: value.toString(), sucursal_id: s.id },
    { onConflict: 'key,sucursal_id' }
  );
  return result.error;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

/**
 * dbUpdateIva(value)
 * Actualiza el porcentaje de IVA en la configuración.
 * Retorna: error (null si OK)
 */
async function dbUpdateIva(value) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('configuracion').upsert(
    { key: 'iva', value: value.toString(), sucursal_id: s.id },
    { onConflict: 'key,sucursal_id' }
  );
  return result.error;
}

// ============================================================
// MÉTODOS DE PAGO / DESCUENTOS
// ============================================================

/**
 * dbAddPaymentMethod(name, discount)
 * Agrega un método de pago con su descuento porcentual.
 * Retorna: error (null si OK)
 */
async function dbAddPaymentMethod(name, discount) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('metodos_pago').insert([{
    name:        name,
    discount:    discount,
    sucursal_id: s.id
  }]);
  return result.error;
}

/**
 * dbDeletePaymentMethod(id)
 * Elimina un método de pago por ID.
 * Retorna: error (null si OK)
 */
async function dbDeletePaymentMethod(id) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var result = await window.sb.from('metodos_pago').delete().eq('id', id);
  return result.error;
}

// ============================================================
// PROMOCIONES
// ============================================================

/**
 * dbAddPromotion(code, take, pay)
 * Agrega una promoción "Llevá X, Pagá Y".
 * Retorna: error (null si OK)
 */
async function dbAddPromotion(code, take, pay) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var s = _getSucursal();
  if (!s) return { message: 'Sin sucursal activa' };

  var result = await window.sb.from('promociones').insert([{
    code:        code,
    take:        take,
    pay:         pay,
    sucursal_id: s.id
  }]);
  return result.error;
}

/**
 * dbDeletePromotion(id)
 * Elimina una promoción por ID.
 * Retorna: error (null si OK)
 */
async function dbDeletePromotion(id) {
  if (!_checkSb()) return { message: 'Supabase no disponible' };
  var result = await window.sb.from('promociones').delete().eq('id', id);
  return result.error;
}
