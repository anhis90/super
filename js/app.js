/**
 * js/app.js
 * Punto de entrada principal (Orquestador).
 */

import { state } from './state.js';
import { api } from './api.js';
import { checkSession, login, logout } from './auth.js';
import { showLogin, showMain, updateDate, renderAll, openPopup, closePopups } from './ui.js';
import { addProductToCart, searchProducts } from './cart.js';

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  // 1. Tema
  if (localStorage.getItem('pos_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // 2. Reloj
  setInterval(updateDate, 1000);
  updateDate();

  // 3. Listeners de Inputs
  setupEventListeners();

  // 4. Sesión
  if (checkSession()) {
    const loaded = await api.loadInitialData();
    if (loaded) {
      showMain();
    } else {
      // Si no hay sucursal, mostrar modal de configuración
      showMain();
      openPopup('sucursal');
    }
  } else {
    showLogin();
  }
}

function setupEventListeners() {
  // Input de código en POS
  const codeInp = document.getElementById('product-code');
  if (codeInp) {
    codeInp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addProductToCart(codeInp.value);
    });
    codeInp.addEventListener('input', (e) => {
      searchProducts(e.target.value);
    });
  }

  // Botón de login
  window.handleLogin = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const res = login(user, pass);
    
    if (res.success) {
      await api.loadInitialData();
      showMain();
    } else {
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = res.message;
        errEl.style.display = 'block';
      }
    }
  };

  // Botón de logout
  window.handleLogout = logout;
  
  // Otros globales necesarios para el HTML inline
  window.api = api;
  window.state = state;
}

// Exponer funciones adicionales a window para compatibilidad con index.html
window.showReceipt = (tx) => {
  const rec = document.getElementById('receipt-summary');
  if (!rec) return;

  const itemsHtml = tx.items.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:14px;">
      <span>${i.name} (x${i.qty})</span>
      <span>$${(i.price * i.qty).toFixed(2)}</span>
    </div>
  `).join('');

  rec.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <h2 style="margin:0; color:var(--primary);">Super POS Pro</h2>
      <p style="margin:5px 0; font-size:12px; color:var(--text-muted);">Comprobante de Pago</p>
    </div>
    <div style="border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:15px 0; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#666; margin-bottom:10px;">
        <span>Ticket: <strong>${tx.code}</strong></span>
        <span>${tx.date}</span>
      </div>
      ${itemsHtml}
    </div>
    <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:800;">
      <span>TOTAL</span>
      <span>$${tx.total.toFixed(2)}</span>
    </div>
  `;
  openPopup('receipt');
};

// Funciones administrativas para el HTML
window.addNewProduct = async () => {
  const name = document.getElementById('new-prod-name').value;
  const price = parseFloat(document.getElementById('new-prod-price').value);
  const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;
  const code = document.getElementById('new-prod-code').value;
  const image = window._generatedProductImage || null;

  if (!name || isNaN(price) || !code) return alert('Completá los campos');

  const err = await api.addProduct({ name, price, stock, code, image });
  if (err) alert(err.message);
  else {
    await api.loadInitialData();
    renderAll();
    alert('Producto agregado');
  }
};

window.adjustStock = async (code) => {
  const p = state.products.find(prod => String(prod.code) === String(code));
  const val = prompt(`Ajustar stock para ${p.name}:`, p.stock);
  if (val === null) return;
  const err = await api.updateStock(p.id, parseInt(val) || 0);
  if (!err) { await api.loadInitialData(); renderAll(); }
};

window.deleteProduct = async (code) => {
  if (!confirm('¿Eliminar?')) return;
  const p = state.products.find(prod => String(prod.code) === String(code));
  const err = await api.deleteProduct(p.id);
  if (!err) { await api.loadInitialData(); renderAll(); }
};

window.voidTransaction = async (id) => {
  if (!confirm('¿Anular transacción?')) return;
  // Implementación simplificada para el refactor
  alert('Funcionalidad de anulación parcial. Refresque para ver cambios.');
  await api.loadInitialData();
  renderAll();
};
