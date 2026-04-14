// ============================================================
// js/ui.js
// Toda la lógica de renderizado e interfaz de usuario
// Nunca llama a Supabase directamente — usa funciones de db.js
// ============================================================

// ─────────────────────────────────────────────
// NAVEGACIÓN / PANTALLAS
// ─────────────────────────────────────────────

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-app').style.display     = 'none';
}

function showMain() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display     = 'flex';
  document.getElementById('user-role-badge').textContent = currentUser.role;
  updateUIByRole();
  renderAll();
}

/**
 * updateUIByRole()
 * Muestra u oculta elementos según el rol del usuario logueado.
 * Elementos con clase .admin-only solo los ve el admin.
 */
function updateUIByRole() {
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
}

function updateDate() {
  const el = document.getElementById('date-display');
  if (el) el.textContent = new Date().toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('pos_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// ─────────────────────────────────────────────
// RENDERIZADO PRINCIPAL
// ─────────────────────────────────────────────

/**
 * renderAll()
 * Re-renderiza todas las secciones de la interfaz.
 * Se llama después de cualquier cambio de datos.
 */
function renderAll() {
  renderPOSProducts();
  renderProductTable();
  renderSuppliers();
  renderPurchases();
  renderStats();
  renderTransactions();
  populateSelects();
  renderDiscountRules();
  renderPromos();
  renderCart();
  // Ejecutar análisis de IA después de renderizar todo
  if (typeof analyzeBusinessData === 'function') analyzeBusinessData();
}

/**
 * renderPOSProducts()
 * Dibuja la grilla de productos en el Punto de Venta para selección rápida.
 */
function renderPOSProducts() {
  const container = document.getElementById('pos-products');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No hay productos cargados en esta sucursal.</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="pos-product-card" onclick="addProductToCart('${p.code}')">
      <img src="${p.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}" class="pos-product-thumb" alt="${p.name}">
      <div class="pos-product-name">${p.name}</div>
      <div class="pos-product-price">$${parseFloat(p.price).toFixed(2)}</div>
      <div class="pos-product-stock ${p.stock < 5 ? 'stock-low' : ''}">Stock: ${p.stock}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// CARRITO
// ─────────────────────────────────────────────

function renderCart() {
  const container = document.getElementById('cart-items');
  container.innerHTML = '';
  let subtotal = 0;

  cart.forEach((item, idx) => {
    subtotal += item.price * item.qty;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-price">$${parseFloat(item.price).toFixed(2)} × ${item.qty}</span>
      </div>
      <div class="item-actions">
        <button onclick="changeQty(${idx}, 1)">+</button>
        <span class="qty">${item.qty}</span>
        <button onclick="changeQty(${idx}, -1)">−</button>
      </div>
    `;
    container.appendChild(div);
  });

  calculateTotals(subtotal);
}

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.code}</td>
      <td><img src="${p.image || ''}" width="30" style="border-radius:6px"></td>
      <td>${p.name}</td>
      <td>$${parseFloat(p.price).toFixed(2)}</td>
      <td class="${p.stock < 5 ? 'stock-low' : ''}">${p.stock}</td>
      <td class="admin-only" style="display:flex; gap:8px;">
        <button class="action-btn" style="padding:5px 10px;font-size:12px;"
          onclick="adjustStock('${p.code}')" title="Ajustar Stock">
          <i class="ri-edit-line"></i>
        </button>
        <button class="btn-icon-red" onclick="deleteProduct('${p.code}')" title="Eliminar">
          <i class="ri-close-circle-fill"></i>
        </button>
      </td>
    </tr>
  `).join('');

  updateUIByRole();
}

async function addNewProduct() {
  const code  = document.getElementById('new-prod-code').value.trim();
  const name  = document.getElementById('new-prod-name').value.trim();
  const price = parseFloat(document.getElementById('new-prod-price').value);
  const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;

  if (!code || !name || isNaN(price)) {
    alert('Completá todos los campos correctamente');
    return;
  }

  const error = await dbAddProduct(code, name, price, stock);
  if (error) {
    alert('Error: ' + error.message);
  } else {
    await loadInitialData();
    renderAll();
    alert('✅ Producto añadido');
    document.querySelectorAll('#popup-lista input').forEach(i => i.value = '');
  }
}

async function deleteProduct(code) {
  if (!confirm('¿Eliminar producto?')) return;
  const prod = products.find(p => p.code === code);
  if (!prod) return;
  const error = await dbDeleteProduct(prod.id);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderProductTable();
  }
}

async function adjustStock(code) {
  const p = products.find(prod => prod.code === code);
  const newVal = prompt(`Ajustar stock para "${p.name}":`, p.stock);
  if (newVal === null) return;
  const stock = parseInt(newVal) || 0;
  const error = await dbUpdateStock(p.id, stock);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderAll();
  }
}

// ─────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────

function renderSuppliers() {
  const tbody = document.getElementById('suppliers-table-body');
  if (!tbody) return;
  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.contact || '—'}</td>
      <td class="admin-only">
        <button class="btn-icon-red" title="Eliminar">
          <i class="ri-close-circle-fill"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function addSupplier() {
  const name    = document.getElementById('prov-name').value.trim();
  const contact = document.getElementById('prov-contact').value.trim();
  if (!name) { alert('Ingresá el nombre del proveedor'); return; }

  const error = await dbAddSupplier(name, contact);
  if (error) {
    alert(error.message);
  } else {
    await loadInitialData();
    renderSuppliers();
    document.getElementById('prov-name').value    = '';
    document.getElementById('prov-contact').value = '';
  }
}

// ─────────────────────────────────────────────
// COMPRAS
// ─────────────────────────────────────────────

function renderPurchases() {
  const tbody = document.getElementById('purchases-table-body');
  if (!tbody) return;
  tbody.innerHTML = purchases.map(p => `
    <tr>
      <td>${p.date}</td>
      <td>${p.prov}</td>
      <td>${p.prod}</td>
      <td>${p.qty}</td>
      <td>$${parseFloat(p.cost).toFixed(2)}</td>
    </tr>
  `).join('');
}

async function registerPurchase() {
  const provId = document.getElementById('compra-prov').value;
  const code   = document.getElementById('compra-code').value.trim();
  const qty    = parseInt(document.getElementById('compra-qty').value);
  const cost   = parseFloat(document.getElementById('compra-cost').value);

  const prod = products.find(p => p.code === code);
  if (!prod || !provId || qty <= 0 || isNaN(cost)) {
    alert('Datos de compra inválidos o producto no encontrado');
    return;
  }

  const { data: compra, error: cError } = await dbCreatePurchase(provId, cost * qty);
  if (cError) { alert(cError.message); return; }

  const dError = await dbCreatePurchaseDetail(compra[0].id, prod.id, qty, cost);
  if (dError) { alert(dError.message); return; }

  // Sumar stock al producto
  await dbUpdateStock(prod.id, prod.stock + qty);
  await loadInitialData();
  renderAll();
  alert('✅ Stock actualizado y compra registrada');
  document.querySelectorAll('#popup-compras input').forEach(i => i.value = '');
}

// ─────────────────────────────────────────────
// ESTADÍSTICAS / DASHBOARD
// ─────────────────────────────────────────────

function renderStats() {
  const today      = new Date().toLocaleDateString('es-AR');
  const todaySales = transactions.filter(t => t.date.includes(today));
  const totalToday = todaySales.reduce((s, t) => s + t.total, 0);
  const lowStock   = products.filter(p => p.stock < 5).length;

  document.getElementById('dashboard-ventas-dia').textContent  = `$${totalToday.toFixed(2)}`;
  document.getElementById('dashboard-operaciones').textContent = todaySales.length;
  document.getElementById('dashboard-low-stock').textContent   = lowStock;
  document.getElementById('dashboard-low-stock').style.color   =
    lowStock > 0 ? 'var(--danger)' : 'var(--success)';

  // Caja
  const cashSales = transactions
    .filter(t => t.method.toLowerCase().includes('efectivo'))
    .reduce((s, t) => s + t.total, 0);
  const totalCash = openingCash + cashSales;

  const cajaOpeningEl = document.getElementById('caja-monto-apertura');
  if (cajaOpeningEl) cajaOpeningEl.textContent = `$${openingCash.toFixed(2)}`;

  const cajaTotalEl = document.getElementById('caja-monto-total');
  if (cajaTotalEl) cajaTotalEl.textContent = `$${totalCash.toFixed(2)}`;

  // Total de ingresos (reportes)
  const reportEl = document.getElementById('report-income-total');
  if (reportEl) reportEl.textContent =
    `$${transactions.reduce((s, t) => s + t.total, 0).toFixed(2)}`;

  // Top productos en la sección de reportes (usa productName)
  const salesMap = {};
  transactions.forEach(t => t.items.forEach(i => {
    const key = i.productName || i.name || 'Desconocido';
    salesMap[key] = (salesMap[key] || 0) + i.qty;
  }));
  const top = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topEl = document.getElementById('top-products-list');
  if (topEl) topEl.innerHTML = top.map(p =>
    `<li>${p[0]} <strong>(${p[1]} vend.)</strong></li>`
  ).join('');
}

// ─────────────────────────────────────────────
// TRANSACCIONES / HISTORIAL
// ─────────────────────────────────────────────

function renderTransactions() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  tbody.innerHTML = [...transactions].map(t => `
    <tr>
      <td>${t.code}</td>
      <td>${t.date}</td>
      <td>${t.method}</td>
      <td>$${parseFloat(t.total).toFixed(2)}</td>
      <td class="admin-only">
        <button class="btn-icon-red" title="Anular">
          <i class="ri-close-circle-fill"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function clearTransactions() {
  if (!confirm('¿Borrar todo el historial de ventas?')) return;
  const error = await dbClearSales();
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderAll();
  }
}

// ─────────────────────────────────────────────
// RECIBO / TICKET
// ─────────────────────────────────────────────

function showReceipt(tx) {
  const rec = document.getElementById('receipt-summary');
  rec.innerHTML = `
    <h3>TICKET PRO — ${tx.code}</h3>
    <p>${tx.date}</p><hr>
    ${tx.items.map(i =>
      // productName es el campo nuevo; usamos 'name' como fallback para el carrito local
      `<div>${i.productName || i.name} ×${i.qty} — $${(i.price * i.qty).toFixed(2)}</div>`
    ).join('')}
    <hr>
    <div class="total-p">TOTAL: $${tx.total.toFixed(2)}</div>
    <p>IVA incluido (${ivaConfig}%)</p>
  `;
  document.getElementById('checkout-modal').classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

// ─────────────────────────────────────────────
// SELECTS (populate)
// ─────────────────────────────────────────────

function populateSelects() {
  // Proveedor en compras
  const provSelect = document.getElementById('compra-prov');
  if (provSelect) {
    provSelect.innerHTML = '<option value="">Seleccionar Proveedor</option>' +
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  // Métodos de pago en el carrito
  const pmSelect = document.getElementById('payment-method');
  if (pmSelect) {
    pmSelect.innerHTML = paymentRules.map(r =>
      `<option value="${r.id}">${r.name} (${r.discount}%)</option>`
    ).join('');
  }
}

// ─────────────────────────────────────────────
// DESCUENTOS / MÉTODOS DE PAGO
// ─────────────────────────────────────────────

function renderDiscountRules() {
  const list = document.getElementById('discounts-list');
  if (!list) return;
  list.innerHTML = paymentRules.map(r => `
    <li>
      <span>${r.name} (${r.discount}%)</span>
      <button class="btn-icon-red" onclick="removeDiscountRule('${r.id}')" title="Eliminar">
        <i class="ri-close-circle-fill"></i>
      </button>
    </li>
  `).join('');
}

async function addDiscountRule() {
  const name = document.getElementById('desc-name').value.trim();
  const val  = parseFloat(document.getElementById('desc-value').value);
  if (!name || isNaN(val)) { alert('Completá nombre y porcentaje'); return; }

  const error = await dbAddPaymentMethod(name, val);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderAll();
  }
}

async function removeDiscountRule(id) {
  const error = await dbDeletePaymentMethod(id);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderAll();
  }
}

// ─────────────────────────────────────────────
// PROMOCIONES
// ─────────────────────────────────────────────

function renderPromos() {
  const list = document.getElementById('promo-list');
  if (!list) return;
  list.innerHTML = promos.map(p => `
    <li>
      <span>Llevá ${p.take}, Pagá ${p.pay} (Cód: ${p.code})</span>
      <button class="btn-icon-red" onclick="removePromo('${p.id}')" title="Eliminar">
        <i class="ri-close-circle-fill"></i>
      </button>
    </li>
  `).join('');
}

async function addPromotion() {
  const code = document.getElementById('promo-code').value.trim();
  const take = parseInt(document.getElementById('promo-take').value);
  const pay  = parseInt(document.getElementById('promo-pay').value);

  if (!code || take <= pay) {
    alert('"Llevá" debe ser mayor a "Pagá"');
    return;
  }

  const error = await dbAddPromotion(code, take, pay);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderPromos();
  }
}

async function removePromo(id) {
  // Ahora usa Supabase (ya no localStorage)
  const error = await dbDeletePromotion(id);
  if (error) alert(error.message);
  else {
    await loadInitialData();
    renderPromos();
  }
}

// ─────────────────────────────────────────────
// CAJA
// ─────────────────────────────────────────────

async function setOpeningCash() {
  const val = parseFloat(document.getElementById('opening-cash-input-caja').value);
  if (isNaN(val)) { alert('Ingresá un monto válido'); return; }
  openingCash = val;
  const error = await dbSetOpeningCash(val);
  if (error) alert(error.message);
  else { renderStats(); alert('✅ Monto de apertura establecido'); }
}

async function registerCajaOp() {
  const tipo   = document.getElementById('caja-tipo').value;
  const monto  = parseFloat(document.getElementById('caja-monto').value);
  const motivo = document.getElementById('caja-motivo').value.trim();

  if (monto <= 0 || isNaN(monto)) { alert('Ingresá un monto válido'); return; }

  const error = await dbRegisterCashMovement(tipo, monto, motivo);
  if (error) {
    alert(error.message);
  } else {
    alert(`✅ Operación de ${tipo} por $${monto} registrada`);
    document.getElementById('caja-monto').value  = '';
    document.getElementById('caja-motivo').value = '';
    await loadInitialData();
    renderStats();
  }
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────

async function updateIVAConfig(val) {
  ivaConfig = parseFloat(val);
  await dbUpdateIva(val);
  renderCart();
}

// ─────────────────────────────────────────────
// POPUPS / MODALES
// ─────────────────────────────────────────────

function openPopup(id) {
  document.getElementById(`popup-${id}`).classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

function closePopups() {
  document.querySelectorAll('.popup, .overlay').forEach(el => el.classList.remove('active'));
}

// ─────────────────────────────────────────────
// EXPORTAR DATOS
// ─────────────────────────────────────────────

function exportData(type) {
  const data = type === 'products' ? products : transactions;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pos_${type}_${Date.now()}.json`;
  a.click();
}
