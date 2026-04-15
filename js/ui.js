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
  setupImagePreview();
}

function updateUIByRole() {
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
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
  if (typeof analyzeBusinessData === 'function') analyzeBusinessData();
  
  // Update next code if in admin mode
  const codeInp = document.getElementById('new-prod-code');
  if (codeInp && !codeInp.value) {
    codeInp.value = getNextProductCode();
  }
}

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
  if (!container) return;
  container.innerHTML = '';
  let subtotal = 0;

  cart.forEach((item, idx) => {
    subtotal += item.price * item.qty;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; flex:1;">
        <img src="${item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80'}" 
             style="width:50px; height:50px; border-radius:8px; object-fit:cover; border:1px solid var(--glass-border);">
        <div class="item-info">
          <span class="item-name" style="display:block; font-size:15px;">${item.name}</span>
          <span class="item-price" style="color:var(--primary); font-weight:600;">$${parseFloat(item.price).toFixed(2)}</span>
        </div>
      </div>
      <div class="item-actions" style="display:flex; align-items:center; gap:8px;">
        <button class="qty-btn" onclick="changeQty(${idx}, -1)">-</button>
        <span class="qty">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
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
      <td><img src="${p.image || ''}" width="30" style="border-radius:6px; height:30px; object-fit:cover;"></td>
      <td>${p.name}</td>
      <td>$${parseFloat(p.price).toFixed(2)}</td>
      <td class="${p.stock < 5 ? 'stock-low' : ''}">${p.stock}</td>
      <td class="admin-only">
        <div style="display:flex; gap:8px;">
          <button class="action-btn" style="padding:5px 10px;font-size:12px;"
            onclick="adjustStock('${p.code}')" title="Ajustar Stock">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-icon-red" onclick="deleteProduct('${p.code}')" title="Eliminar">
            <i class="ri-close-circle-fill"></i>
          </button>
        </div>
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
  
  const imgInput = document.getElementById('new-prod-img');
  const imgData = window._generatedProductImage || null; 

  if (!code || !name || isNaN(price)) {
    alert('Completá todos los campos correctamente');
    return;
  }

  const error = await dbAddProduct(code, name, price, stock, imgData);
  if (error) {
    alert('Error: ' + error.message);
  } else {
    await loadInitialData();
    renderAll();
    alert('✅ Producto añadido');
    
    // Reset Form
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-price').value = '';
    document.getElementById('new-prod-stock').value = '';
    if (imgInput) imgInput.value = '';
    const preview = document.getElementById('new-prod-img-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    window._generatedProductImage = null;
    document.getElementById('new-prod-code').value = getNextProductCode();
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
// COMPRAS / INGRESO DE STOCK
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
  const todaySales = transactions.filter(t => t.date && t.date.includes(today));
  const totalToday = todaySales.reduce((s, t) => s + t.total, 0);
  const lowStock   = products.filter(p => p.stock < 5).length;

  const vDia = document.getElementById('dashboard-ventas-dia');
  if (vDia) vDia.textContent = `$${totalToday.toFixed(2)}`;
  
  const vOps = document.getElementById('dashboard-operaciones');
  if (vOps) vOps.textContent = todaySales.length;
  
  const vLow = document.getElementById('dashboard-low-stock');
  if (vLow) {
    vLow.textContent = lowStock;
    vLow.style.color = lowStock > 0 ? 'var(--danger)' : 'var(--success)';
  }

  // Caja
  const cashSales = transactions
    .filter(t => t.method && t.method.toLowerCase().includes('efectivo'))
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

  // Top productos
  const salesMap = {};
  transactions.forEach(t => {
    if (t.items) t.items.forEach(i => {
      const key = i.productName || i.name || 'Desconocido';
      salesMap[key] = (salesMap[key] || 0) + i.qty;
    });
  });
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
        <button class="btn-icon-red" onclick="voidTransaction('${t.id || t.code}')" title="Anular">
          <i class="ri-close-circle-fill"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function voidTransaction(id) {
  if (!confirm('¿Anular esta transacción? Se restaurará el stock de los productos.')) return;
  const tx = transactions.find(t => t.id === id || t.code === id);
  if (!tx) { alert('No se encontró el registro de la venta.'); return; }

  // 1. Restaurar stock PRIMERO (antes de borrar la venta para no perder los datos)
  if (tx.items && tx.items.length > 0) {
    for (const item of tx.items) {
      // Intentar encontrar producto por código o nombre
      const p = products.find(prod => 
        (prod.code && prod.code === item.productCode) || 
        (prod.name && prod.name === item.productName)
      );
      
      if (p) {
        const currentStock = Number(p.stock) || 0;
        const qtyToRestore = Number(item.qty) || 0;
        await dbUpdateStock(p.id, currentStock + qtyToRestore);
      }
    }
  }

  // 2. Borrar la venta de la base de datos
  const err = await dbVoidSale(tx.id || tx.code);
  if (err) { 
    alert('Error al borrar la venta: ' + err.message); 
    return; 
  }

  await loadInitialData();
  renderAll();
  alert('✅ Transacción anulada y stock restaurado correctamente');
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
  if (!rec) return;

  const itemsHtml = tx.items.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:14px;">
      <span>${i.name || i.productName} (x${i.qty})</span>
      <span>$${(i.price * i.qty).toFixed(2)}</span>
    </div>
  `).join('');

  rec.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <h2 style="margin:0; color:var(--primary);">Super POS Pro</h2>
      <p style="margin:5px 0; font-size:12px; color:var(--text-muted);">Comprobante de Pago</p>
    </div>
    <div style="border-top:1px dashed var(--glass-border); border-bottom:1px dashed var(--glass-border); padding:15px 0; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:10px;">
        <span>Ticket: <strong>${tx.code}</strong></span>
        <span>${tx.date}</span>
      </div>
      ${itemsHtml}
    </div>
    <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:800; margin-bottom:5px;">
      <span>TOTAL</span>
      <span>$${parseFloat(tx.total).toFixed(2)}</span>
    </div>
    <p style="text-align:right; font-size:12px; color:var(--primary); margin:0;">Medio: ${tx.method}</p>
  `;
  openPopup('receipt');
}

// ─────────────────────────────────────────────
// CONFIGURACIÓN E IMÁGENES DIVERSAS
// ─────────────────────────────────────────────

function getNextProductCode() {
  if (!products || products.length === 0) return '001';
  let max = 0;
  products.forEach(p => {
    const n = parseInt(p.code?.replace(/[^0-9]/g, '') || '0', 10);
    if (n > max) max = n;
  });
  return String(max + 1).padStart(3, '0');
}

function setupImagePreview() {
  const inp = document.getElementById('new-prod-img');
  const nameInp = document.getElementById('new-prod-name');
  const preview = document.getElementById('new-prod-img-preview');
  if (!preview) return;

  if (inp) {
    inp.addEventListener('change', () => {
      const file = inp.files?.[0];
      if (!file) { preview.style.display = 'none'; preview.src = ''; return; }
      const reader = new FileReader();
      reader.onload = () => { preview.src = reader.result; preview.style.display = 'inline-block'; window._generatedProductImage = reader.result; };
      reader.readAsDataURL(file);
    });
  }

  if (nameInp) {
    let timeout = null;
    nameInp.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (nameInp.value.length >= 3) generateProductPhotoAI();
      }, 1200);
    });
  }
}

function generateProductPhotoAI() {
  const name = document.getElementById('new-prod-name')?.value || 'Producto';
  const data = generateProductPhoto(name);
  const preview = document.getElementById('new-prod-img-preview');
  if (preview) { preview.src = data; preview.style.display = 'inline-block'; }
  window._generatedProductImage = data;
}

function generateProductPhoto(label) {
  const name = (label || '').toLowerCase();
  const library = [
    { keywords: ['yerba', 'mate'], url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400' },
    { keywords: ['leche', 'milk'], url: 'https://images.unsplash.com/photo-1550583724-125581828cd1?w=400' },
    { keywords: ['pan', 'bakery'], url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' },
    { keywords: ['gaseosa', 'cola'], url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400' }
  ];
  const match = library.find(item => item.keywords.some(k => name.includes(k)));
  if (match) return match.url;
  return `https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80`;
}

// ─────────────────────────────────────────────
// UTILIDADES UI
// ─────────────────────────────────────────────

function populateSelects() {
  const provSelect = document.getElementById('compra-prov');
  if (provSelect) {
    provSelect.innerHTML = '<option value="">Seleccionar Proveedor</option>' +
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  const pmSelect = document.getElementById('payment-method');
  if (pmSelect) {
    pmSelect.innerHTML = paymentRules.map(r =>
      `<option value="${r.id}">${r.name} (${r.discount}%)</option>`
    ).join('');
  }
}

function openPopup(id) {
  document.getElementById(`popup-${id}`).classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

function closePopups() {
  document.querySelectorAll('.popup, .overlay').forEach(el => el.classList.remove('active'));
}

async function addDiscountRule() {
  const name = document.getElementById('desc-name').value.trim();
  const val  = parseFloat(document.getElementById('desc-value').value);
  if (!name || isNaN(val)) return;
  const error = await dbAddPaymentMethod(name, val);
  if (!error) { await loadInitialData(); renderAll(); }
}

function renderDiscountRules() {
  const list = document.getElementById('discounts-list');
  if (!list) return;
  list.innerHTML = paymentRules.map(r => `<li><span>${r.name} (${r.discount}%)</span> <button class="btn-icon-red" onclick="removeDiscountRule('${r.id}')">✕</button></li>`).join('');
}

async function removeDiscountRule(id) {
  const error = await dbDeletePaymentMethod(id);
  if (!error) { await loadInitialData(); renderAll(); }
}

async function addPromotion() {
  const code = document.getElementById('promo-code').value.trim();
  const take = parseInt(document.getElementById('promo-take').value);
  const pay  = parseInt(document.getElementById('promo-pay').value);
  if (!code || take <= pay) return;
  const error = await dbAddPromotion(code, take, pay);
  if (!error) { await loadInitialData(); renderAll(); }
}

function renderPromos() {
  const list = document.getElementById('promo-list');
  if (!list) return;
  list.innerHTML = promos.map(p => `<li><span>Llevá ${p.take}, Pagá ${p.pay} (Cód: ${p.code})</span> <button class="btn-icon-red" onclick="removePromo('${p.id}')">✕</button></li>`).join('');
}

async function removePromo(id) {
  const error = await dbDeletePromotion(id);
  if (!error) { await loadInitialData(); renderAll(); }
}

async function registerCajaOp() {
  const tipo   = document.getElementById('caja-tipo').value;
  const monto  = parseFloat(document.getElementById('caja-monto').value);
  const motivo = document.getElementById('caja-motivo').value.trim();
  if (isNaN(monto) || monto <= 0) return;
  const error = await dbRegisterCashMovement(tipo, monto, motivo);
  if (!error) { await loadInitialData(); renderStats(); alert('Operación registrada'); }
}

async function updateIVAConfig(val) {
  await dbUpdateIva(val);
  ivaConfig = parseFloat(val);
  renderCart();
}

function exportData(type) {
  const data = type === 'products' ? products : transactions;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pos_${type}_${Date.now()}.json`;
  a.click();
}

window.toggleForm = function(id, titleEl) {
  const el = document.getElementById(id);
  if (!el) return;
  const icon = titleEl.querySelector('i');
  if (el.style.display === 'none') {
    el.style.display = 'flex'; // Usando flex u block según el caso, input-inline suele ser flex pero en style.css dice display:flex para .input-inline y display:block para div standard. Si es input-inline lo hace el navegador
    if (el.classList.contains('input-inline')) {
       el.style.display = 'flex';
    } else {
       el.style.display = 'block';
    }
    if (icon) icon.style.transform = 'rotate(-180deg)';
  } else {
    el.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
};
