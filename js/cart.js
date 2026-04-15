// ============================================================
// js/cart.js
// Lógica del carrito de compras
// Maneja agregar, quitar, calcular totales y el checkout
// ============================================================

/**
 * searchProducts(query)
 * Filtra productos por nombre o código y muestra dropdown de resultados.
 */
function searchProducts(query) {
  const results = document.getElementById('search-results');
  if (!query) { results.style.display = 'none'; return; }

  const q = query.toLowerCase();
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.code.includes(query)
  );

  if (!matches.length) { results.style.display = 'none'; return; }

  results.innerHTML = matches.map(p =>
    `<div class="search-item" onclick="addProductToCart('${p.code}')">
      ${p.name} — <strong>$${p.price}</strong>
      <span style="color: ${p.stock < 5 ? 'var(--danger)' : 'var(--success)'}">
        (Stock: ${p.stock})
      </span>
    </div>`
  ).join('');
  results.style.display = 'block';
}

/**
 * addProductToCart(code)
 * Agrega un producto al carrito buscándolo por código.
 * Valida stock disponible antes de agregar.
 */
function addProductToCart(code) {
  document.getElementById('search-results').style.display = 'none';
  const product = products.find(p => p.code === code);

  if (!product)           { alert('Producto no encontrado'); return; }
  if (product.stock <= 0) { alert('¡Sin stock disponible!'); return; }

  const cartIdx = cart.findIndex(item => item.code === code);
  if (cartIdx > -1) {
    // Ya existe en el carrito — aumentar cantidad si hay stock
    if (cart[cartIdx].qty + 1 > product.stock) {
      alert('No hay suficiente stock');
      return;
    }
    cart[cartIdx].qty++;
  } else {
    // Nuevo item en carrito
    cart.push({ ...product, qty: 1 });
  }

  playScanSound();
  showPreview(product);
  renderCart();

  // Limpiar input y reenfocar para el siguiente escaneo
  const input = document.getElementById('product-code');
  input.value = '';
  input.focus();
}

/**
 * changeQty(idx, delta)
 * Aumenta o disminuye la cantidad de un item en el carrito.
 * Si la cantidad llega a 0, elimina el item.
 */
function changeQty(idx, delta) {
  const item    = cart[idx];
  const product = products.find(p => p.code === item.code);

  if (delta > 0 && item.qty + delta > product.stock) {
    alert('Sin stock suficiente');
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) cart.splice(idx, 1);
  renderCart();
}

/**
 * showPreview(product)
 * Muestra la imagen y datos del último producto escaneado.
 */
function showPreview(p) {
  const container = document.getElementById('product-preview');
  container.innerHTML = `
    <div class="scanned-product">
      <img src="${p.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p class="price">$${parseFloat(p.price).toFixed(2)}</p>
      <p style="color: ${p.stock < 5 ? 'var(--danger)' : 'var(--success)'}">
        Stock disponible: ${p.stock}
      </p>
    </div>
  `;
}

/**
 * calculateTotals(subtotal)
 * Calcula descuentos por promociones y método de pago, más IVA.
 * Actualiza los spans del resumen en pantalla.
 */
function calculateTotals(subtotal) {
  // Descuento por promociones "Llevá X, Pagá Y"
  let promoDiscount = 0;
  cart.forEach(item => {
    const promo = promos.find(p => p.code === item.code);
    if (promo && item.qty >= promo.take) {
      const groups      = Math.floor(item.qty / promo.take);
      const freePerGroup = promo.take - promo.pay;
      promoDiscount += groups * freePerGroup * item.price;
    }
  });

  // Descuento por método de pago seleccionado
  const pmId  = document.getElementById('payment-method').value;
  const rule  = paymentRules.find(r => r.id === pmId) || { discount: 0 };
  const discAmount = (subtotal - promoDiscount) * (rule.discount / 100) + promoDiscount;
  const taxAmount  = (subtotal - discAmount) * (ivaConfig / 100);
  const total      = subtotal - discAmount + taxAmount;

  // Actualizar UI
  document.getElementById('subtotal').textContent   = `$${subtotal.toFixed(2)}`;
  document.getElementById('iva-amount').textContent = `$${taxAmount.toFixed(2)}`;
  document.getElementById('total').textContent      = `$${total.toFixed(2)}`;
  // Mostrar porcentaje de IVA actual
  const ivaLabel = document.getElementById('iva-label');
  if (ivaLabel) ivaLabel.textContent = ivaConfig;

  const discRow = document.getElementById('discount-row');
  if (discAmount > 0) {
    discRow.style.display = 'flex';
    document.getElementById('discount-percent').textContent = rule.discount;
    document.getElementById('discount-amount').textContent  = `-$${discAmount.toFixed(2)}`;
  } else {
    discRow.style.display = 'none';
  }
}

/**
 * openPaymentModal()
 * Abre el modal de confirmación de cobro mostrando el total.
 */
function openPaymentModal() {
  if (!cart.length) { alert('El carrito está vacío'); return; }
  const total  = document.getElementById('total').textContent;
  const method = document.getElementById('payment-method');
  const methodName = method.options[method.selectedIndex]?.text || '';

  document.getElementById('payment-details').innerHTML =
    `<strong>Total a cobrar: ${total}</strong><br>Medio: ${methodName}`;

  document.getElementById('payment-modal').classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

/**
 * confirmPayment()
 * Registra la venta en Supabase, actualiza el stock y muestra el ticket.
 */
async function confirmPayment() {
  if (!cart.length) return;

  const tkCode = 'TK-' + Date.now().toString().slice(-6);
  const totalRaw = document.getElementById('total').textContent;
  const total    = parseFloat(totalRaw.replace(/[^0-9.-]+/g, ''));
  const pmSelect = document.getElementById('payment-method');
  const method   = pmSelect.options[pmSelect.selectedIndex]?.text || pmSelect.value;

  // 1. Crear venta en Supabase
  const { data: venta, error: vError } = await dbCreateSale(tkCode, total, method);
  if (vError || !venta || !venta.length) { 
    alert('Error al registrar venta. Verifique conexión.'); 
    return; 
  }

  const ventaId = venta[0].id;

  // 2. Guardar detalle de items
  const dError = await dbCreateSaleDetails(ventaId, cart);
  if (dError) { alert('Error en detalle de venta: ' + dError.message); return; }

  // 3. Descontar stock de cada producto
  for (const item of cart) {
    const product  = products.find(p => p.id === item.id);
    if (product) {
      await dbUpdateStock(item.id, product.stock - item.qty);
    }
  }

  // 4. Preparar datos del ticket antes de limpiar el carrito
  const tx = {
    code:   tkCode,
    date:   new Date().toLocaleString('es-AR'),
    method: method,
    total:  total,
    items:  [...cart]
  };

  // 5. Limpiar carrito y refrescar datos
  cart = [];
  await loadInitialData();
  if (typeof analyzeBusinessData === 'function') analyzeBusinessData();
  showReceipt(tx);
}

/**
 * finishCheckout()
 * Cierra el modal de ticket y refresca la interfaz.
 */
function finishCheckout() {
  renderAll();
  closePopups();
}

/**
 * playScanSound()
 * Sonido de escaneo (desactivado por defecto, se puede habilitar).
 */
function playScanSound() {
  // Descomentar para habilitar sonido:
  // const ctx = new AudioContext();
  // const o = ctx.createOscillator();
  // o.connect(ctx.destination);
  // o.frequency.value = 880;
  // o.start(); o.stop(ctx.currentTime + 0.05);
}
