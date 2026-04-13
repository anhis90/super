// ============================================================
// js/db.js
// Capa de acceso a datos — TODAS las llamadas a Supabase van aquí
// Usa window.sb (definido en supabase-client.js)
// Principio: el resto de la app NO llama a sb directamente
// ============================================================

/**
 * Carga todos los datos iniciales de la base de datos.
 * Se llama al iniciar la app y luego de cada operación importante.
 */
async function loadInitialData() {
  // 1. Sucursal principal (tomamos la primera disponible)
  const { data: sucursales, error: sucErr } = await sb.from('sucursales').select('*').limit(1);
  if (sucErr) { console.error('Error cargando sucursal:', sucErr.message); return; }
  currentSucursal = sucursales[0];

  if (!currentSucursal) {
    console.error('No hay sucursales configuradas en la base de datos');
    return;
  }

  const sid = currentSucursal.id;

  // 2. Productos
  const { data: prodData } = await sb.from('productos').select('*').eq('sucursal_id', sid);
  products = prodData || [];

  // 3. Proveedores
  const { data: provData } = await sb.from('proveedores').select('*').eq('sucursal_id', sid);
  suppliers = provData || [];

  // 4. Compras (con detalle y nombre de proveedor)
  const { data: compData } = await sb
    .from('compras')
    .select('*, proveedores(name), detalle_compras(*)')
    .eq('sucursal_id', sid);

  purchases = (compData || []).map(c => ({
    date: new Date(c.date).toLocaleDateString('es-AR'),
    prov: c.proveedores?.name || 'Sin proveedor',
    prod: 'Varios',
    qty:  c.detalle_compras?.reduce((sum, d) => sum + d.qty, 0) || 0,
    cost: c.total
  }));

  // 5. Configuración (IVA y caja de apertura)
  const { data: configData } = await sb.from('configuracion').select('*').eq('sucursal_id', sid);
  ivaConfig    = parseFloat(configData?.find(c => c.key === 'iva')?.value          || 21);
  openingCash  = parseFloat(configData?.find(c => c.key === 'opening_cash')?.value || 0);

  // 6. Métodos de pago / descuentos
  const { data: pmData } = await sb.from('metodos_pago').select('*').eq('sucursal_id', sid);
  paymentRules = pmData || [];

  // 7. Promociones
  const { data: promoData } = await sb.from('promociones').select('*').eq('sucursal_id', sid);
  promos = promoData || [];

  // 8. Ventas (con detalle e items)
  const { data: salesData } = await sb
    .from('ventas')
    .select('*, detalle_ventas(qty, price, productos(name))')
    .eq('sucursal_id', sid)
    .order('date', { ascending: false });

  transactions = (salesData || []).map(s => ({
    code:   s.code,
    date:   new Date(s.date).toLocaleString('es-AR'),
    method: s.method,
    total:  s.total,
    items:  (s.detalle_ventas || []).map(d => ({
      name:  d.productos?.name || 'Producto',
      qty:   d.qty,
      price: d.price
    }))
  }));
}

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

async function dbAddProduct(code, name, price, stock) {
  const { error } = await sb.from('productos').insert([{
    code, name, price, stock,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
    sucursal_id: currentSucursal.id
  }]);
  return error;
}

async function dbDeleteProduct(productId) {
  const { error } = await sb.from('productos').delete().eq('id', productId);
  return error;
}

async function dbUpdateStock(productId, newStock) {
  const { error } = await sb.from('productos').update({ stock: newStock }).eq('id', productId);
  return error;
}

// ─────────────────────────────────────────────
// VENTAS
// ─────────────────────────────────────────────

async function dbCreateSale(code, total, method) {
  const { data, error } = await sb.from('ventas').insert([{
    code,
    total,
    method,
    // user_id: null — ya no usamos auth, ponemos null
    sucursal_id: currentSucursal.id
  }]).select();
  return { data, error };
}

async function dbCreateSaleDetails(ventaId, cartItems) {
  const detalles = cartItems.map(item => ({
    venta_id:   ventaId,
    product_id: item.id,
    qty:        item.qty,
    price:      item.price
  }));
  const { error } = await sb.from('detalle_ventas').insert(detalles);
  return error;
}

async function dbClearSales() {
  const { error } = await sb.from('ventas').delete().eq('sucursal_id', currentSucursal.id);
  return error;
}

// ─────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────

async function dbAddSupplier(name, contact) {
  const { error } = await sb.from('proveedores').insert([{
    name, contact, sucursal_id: currentSucursal.id
  }]);
  return error;
}

// ─────────────────────────────────────────────
// COMPRAS
// ─────────────────────────────────────────────

async function dbCreatePurchase(supplierId, total) {
  const { data, error } = await sb.from('compras').insert([{
    supplier_id: supplierId,
    total,
    sucursal_id: currentSucursal.id
  }]).select();
  return { data, error };
}

async function dbCreatePurchaseDetail(compraId, productId, qty, cost) {
  const { error } = await sb.from('detalle_compras').insert([{
    compra_id:  compraId,
    product_id: productId,
    qty,
    cost
  }]);
  return error;
}

// ─────────────────────────────────────────────
// CAJA
// ─────────────────────────────────────────────

async function dbRegisterCashMovement(type, amount, reason) {
  const { error } = await sb.from('caja_movimientos').insert([{
    type, amount, reason,
    user_id: null, // sin auth
    sucursal_id: currentSucursal.id
  }]);
  return error;
}

async function dbSetOpeningCash(value) {
  const { error } = await sb.from('configuracion').upsert(
    { key: 'opening_cash', value: value.toString(), sucursal_id: currentSucursal.id },
    { onConflict: 'key,sucursal_id' }
  );
  return error;
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN (IVA)
// ─────────────────────────────────────────────

async function dbUpdateIva(value) {
  const { error } = await sb.from('configuracion').upsert(
    { key: 'iva', value: value.toString(), sucursal_id: currentSucursal.id },
    { onConflict: 'key,sucursal_id' }
  );
  return error;
}

// ─────────────────────────────────────────────
// MÉTODOS DE PAGO / DESCUENTOS
// ─────────────────────────────────────────────

async function dbAddPaymentMethod(name, discount) {
  const { error } = await sb.from('metodos_pago').insert([{
    name, discount, sucursal_id: currentSucursal.id
  }]);
  return error;
}

async function dbDeletePaymentMethod(id) {
  const { error } = await sb.from('metodos_pago').delete().eq('id', id);
  return error;
}

// ─────────────────────────────────────────────
// PROMOCIONES
// ─────────────────────────────────────────────

async function dbAddPromotion(code, take, pay) {
  const { error } = await sb.from('promociones').insert([{
    code, take, pay, sucursal_id: currentSucursal.id
  }]);
  return error;
}

async function dbDeletePromotion(id) {
  const { error } = await sb.from('promociones').delete().eq('id', id);
  return error;
}
