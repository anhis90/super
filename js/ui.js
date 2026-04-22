/**
 * js/ui.js
 * Módulo de Interfaz de Usuario y Renderizado.
 */

import { state } from './state.js';
import { api } from './api.js';
import { logout } from './auth.js';
import { addProductToCart, changeQty, openPaymentModal } from './cart.js';
import { analyzeBusinessData } from './ai.js';

// ─────────────────────────────────────────────
// PANTALLAS Y NAVEGACIÓN
// ─────────────────────────────────────────────

export function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

export function showMain() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  
  const badge = document.getElementById('user-role-badge');
  if (badge && state.currentUser) {
    badge.textContent = state.currentUser.role === 'admin' ? 'Admin' : 'Cajero';
  }
  
  updateUIByRole();
  renderAll();
  setupImagePreview();
}

export function updateUIByRole() {
  const isAdmin = state.currentUser?.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

export function updateDate() {
  const el = document.getElementById('date-display');
  if (el) {
    el.textContent = new Date().toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}

export function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('pos_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// ─────────────────────────────────────────────
// RENDERIZADO GENERAL
// ─────────────────────────────────────────────

export function renderAll() {
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

  // Actualizar código sugerido
  const codeInp = document.getElementById('new-prod-code');
  if (codeInp && !codeInp.value) {
    codeInp.value = getNextProductCode();
  }
}

export function renderPOSProducts() {
  const container = document.getElementById('pos-products');
  if (!container) return;

  if (state.products.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No hay productos cargados.</p>';
    return;
  }

  container.innerHTML = state.products.map(p => `
    <div class="pos-product-card" onclick="window.addProductToCart('${p.code}')">
      <img src="${p.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}" class="pos-product-thumb" alt="${p.name}">
      <div class="pos-product-name">${p.name}</div>
      <div class="pos-product-price">$${parseFloat(p.price).toFixed(2)}</div>
      <div class="pos-product-stock ${p.stock < 5 ? 'stock-low' : ''}">Stock: ${p.stock}</div>
    </div>
  `).join('');
}

export function renderCart() {
  const container = document.getElementById('cart-items');
  if (!container) return;
  container.innerHTML = '';
  
  let subtotalBruto = 0;

  state.cart.forEach((item, idx) => {
    subtotalBruto += item.price * item.qty;
    
    // El ahorro se calcula visualmente aquí (chiche)
    let itemSavings = 0;
    const promo = state.promos.find(p => String(p.code) === String(item.code));
    if (promo && item.qty >= promo.take) {
      const groups = Math.floor(item.qty / promo.take);
      itemSavings = groups * (promo.take - promo.pay) * item.price;
    }
    
    const promoHtml = itemSavings > 0 
      ? `<div class="promo-badge-inline">Promo Aplicada (-$${itemSavings.toFixed(2)})</div>` 
      : '';

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; flex:1;">
        <img src="${item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80'}" class="cart-item-img">
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <span class="item-price">$${parseFloat(item.price).toFixed(2)}</span>
          ${promoHtml}
        </div>
      </div>
      <div class="item-actions">
        <button class="qty-btn" onclick="window.changeQty(${idx}, -1)">-</button>
        <span class="qty">${item.qty}</span>
        <button class="qty-btn" onclick="window.changeQty(${idx}, 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });

  calculateTotalsUI(subtotalBruto);
}

function calculateTotalsUI(subtotalBruto) {
  let promoDiscount = 0;
  state.cart.forEach(item => {
    const promo = state.promos.find(p => String(p.code) === String(item.code));
    if (promo && item.qty >= promo.take) {
      promoDiscount += Math.floor(item.qty / promo.take) * (promo.take - promo.pay) * item.price;
    }
  });

  const subtotalNeto = subtotalBruto - promoDiscount;
  const pmId = document.getElementById('payment-method')?.value;
  const rule = state.paymentRules.find(r => String(r.id) === String(pmId)) || { discount: 0 };
  
  const globalDiscountAmount = subtotalNeto * (rule.discount / 100);
  const taxableAmount = subtotalNeto - globalDiscountAmount;
  const taxAmount = taxableAmount * (state.ivaConfig / 100);
  const total = taxableAmount + taxAmount;

  // Actualizar UI
  setText('subtotal', `$${subtotalBruto.toFixed(2)}`);
  setText('iva-amount', `$${taxAmount.toFixed(2)}`);
  setText('total', `$${total.toFixed(2)}`);
  setText('iva-label', state.ivaConfig);

  const promoRow = document.getElementById('promo-row');
  if (promoRow) {
    promoRow.style.display = promoDiscount > 0 ? 'flex' : 'none';
    setText('promo-amount', `-$${promoDiscount.toFixed(2)}`);
  }

  const discRow = document.getElementById('discount-row');
  if (discRow) {
    discRow.style.display = globalDiscountAmount > 0 ? 'flex' : 'none';
    setText('discount-percent', rule.discount);
    setText('discount-amount', `-$${globalDiscountAmount.toFixed(2)}`);
  }
  
  // Guardar en state para el ticket
  state.currentCheckout = { subtotalBruto, promoDiscount, globalDiscountAmount, taxAmount, total };
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─────────────────────────────────────────────
// TABLAS Y LISTAS
// ─────────────────────────────────────────────

export function renderProductTable() {
  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.products.map(p => `
    <tr>
      <td>${p.code}</td>
      <td><img src="${p.image || ''}" class="table-img"></td>
      <td>${p.name}</td>
      <td>$${parseFloat(p.price).toFixed(2)}</td>
      <td class="${p.stock < 5 ? 'stock-low' : ''}">${p.stock}</td>
      <td class="admin-only">
        <div style="display:flex; gap:8px;">
          <button class="action-btn" onclick="window.adjustStock('${p.code}')"><i class="ri-edit-line"></i></button>
          <button class="btn-icon-red" onclick="window.deleteProduct('${p.code}')"><i class="ri-close-circle-fill"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
  updateUIByRole();
}

export function renderSuppliers() {
  const tbody = document.getElementById('suppliers-table-body');
  if (!tbody) return;
  tbody.innerHTML = state.suppliers.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.contact || '—'}</td>
      <td class="admin-only">
        <button class="btn-icon-red" onclick="window.deleteSupplier('${s.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

export function renderPurchases() {
  const tbody = document.getElementById('purchases-table-body');
  if (!tbody) return;
  tbody.innerHTML = state.purchases.map(p => `
    <tr>
      <td>${p.date}</td>
      <td>${p.prov}</td>
      <td>${p.prod}</td>
      <td>${p.qty}</td>
      <td>$${parseFloat(p.cost).toFixed(2)}</td>
    </tr>
  `).join('');
}

export function renderTransactions() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;
  tbody.innerHTML = [...state.transactions].map(t => `
    <tr>
      <td>${t.code}</td>
      <td>${t.date}</td>
      <td>${t.method}</td>
      <td>$${parseFloat(t.total).toFixed(2)}</td>
      <td class="admin-only">
        <button class="btn-icon-red" onclick="window.voidTransaction('${t.id}')"><i class="ri-close-circle-fill"></i></button>
      </td>
    </tr>
  `).join('');
}

export function renderStats() {
  const today = new Date().toLocaleDateString('es-AR');
  const todaySales = state.transactions.filter(t => t.date && t.date.includes(today));
  const totalToday = todaySales.reduce((s, t) => s + t.total, 0);
  const lowStock = state.products.filter(p => p.stock < 5).length;

  setText('dashboard-ventas-dia', `$${totalToday.toFixed(2)}`);
  setText('dashboard-operaciones', todaySales.length);
  
  const vLow = document.getElementById('dashboard-low-stock');
  if (vLow) {
    vLow.textContent = lowStock;
    vLow.style.color = lowStock > 0 ? 'var(--danger)' : 'var(--success)';
  }

  const cashSales = state.transactions
    .filter(t => t.method && t.method.toLowerCase().includes('efectivo'))
    .reduce((s, t) => s + t.total, 0);
  
  setText('caja-monto-apertura', `$${state.openingCash.toFixed(2)}`);
  setText('caja-monto-total', `$${(state.openingCash + cashSales).toFixed(2)}`);
  setText('report-income-total', `$${state.transactions.reduce((s, t) => s + t.total, 0).toFixed(2)}`);
}

// ─────────────────────────────────────────────
// POPUPS Y UTILIDADES
// ─────────────────────────────────────────────

export function openPopup(id) {
  const el = document.getElementById(`popup-${id}`);
  if (el) el.classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

export function closePopups() {
  document.querySelectorAll('.popup, .overlay').forEach(el => el.classList.remove('active'));
}

export function populateSelects() {
  const provSelect = document.getElementById('compra-prov');
  if (provSelect) {
    provSelect.innerHTML = '<option value="">Seleccionar Proveedor</option>' +
      state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  const pmSelect = document.getElementById('payment-method');
  if (pmSelect) {
    pmSelect.innerHTML = state.paymentRules.map(r =>
      `<option value="${r.id}">${r.name} (${r.discount}%)</option>`
    ).join('');
  }
}

export function renderDiscountRules() {
  const list = document.getElementById('discounts-list');
  if (!list) return;
  list.innerHTML = state.paymentRules.map(r => `<li><span>${r.name} (${r.discount}%)</span> <button class="btn-icon-red" onclick="window.removeDiscountRule('${r.id}')">✕</button></li>`).join('');
}

export function renderPromos() {
  const list = document.getElementById('promo-list');
  if (!list) return;
  list.innerHTML = state.promos.map(p => `<li><span>Llevá ${p.take}, Pagá ${p.pay} (Cód: ${p.code})</span> <button class="btn-icon-red" onclick="window.removePromo('${p.id}')">✕</button></li>`).join('');
}

// ─────────────────────────────────────────────
// AUXILIARES
// ─────────────────────────────────────────────

function getNextProductCode() {
  if (state.products.length === 0) return '001';
  let max = 0;
  state.products.forEach(p => {
    const n = parseInt(p.code?.replace(/[^0-9]/g, '') || '0', 10);
    if (n > max) max = n;
  });
  return String(max + 1).padStart(3, '0');
}

function setupImagePreview() {
  const inp = document.getElementById('new-prod-img');
  const preview = document.getElementById('new-prod-img-preview');
  if (!preview || !inp) return;

  inp.addEventListener('change', () => {
    const file = inp.files?.[0];
    if (!file) { preview.style.display = 'none'; return; }
    const reader = new FileReader();
    reader.onload = () => { 
      preview.src = reader.result; 
      preview.style.display = 'inline-block'; 
      window._generatedProductImage = reader.result; 
    };
    reader.readAsDataURL(file);
  });
}

// Attach essentials to window for HTML inline calls
window.openPopup = openPopup;
window.closePopups = closePopups;
window.handleLogout = logout;
window.toggleDarkMode = toggleDarkMode;
window.addProductToCart = addProductToCart;
window.changeQty = changeQty;
window.openPaymentModal = openPaymentModal;
