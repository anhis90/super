/**
 * js/cart.js
 * Módulo de Lógica de Carrito y Ventas.
 */

import { state } from './state.js';
import { api } from './api.js';
import { renderCart, openPopup, closePopups, renderAll } from './ui.js';

export function searchProducts(query) {
  const results = document.getElementById('search-results');
  if (!query) { results.style.display = 'none'; return; }

  const q = query.toLowerCase();
  const matches = state.products.filter(p =>
    p.name.toLowerCase().includes(q) || p.code.includes(query)
  );

  if (!matches.length) { results.style.display = 'none'; return; }

  results.innerHTML = matches.map(p =>
    `<div class="search-item" onclick="window.addProductToCart('${p.code}')">
      ${p.name} — <strong>$${p.price}</strong>
      <span style="color: ${p.stock < 5 ? 'var(--danger)' : 'var(--success)'}">
        (Stock: ${p.stock})
      </span>
    </div>`
  ).join('');
  results.style.display = 'block';
}

export function addProductToCart(code) {
  const results = document.getElementById('search-results');
  if (results) results.style.display = 'none';

  const product = state.products.find(p => String(p.code) === String(code));

  if (!product) { alert('Producto no encontrado'); return; }
  if (product.stock <= 0) { alert('¡Sin stock disponible!'); return; }

  const cartIdx = state.cart.findIndex(item => String(item.code) === String(code));
  if (cartIdx > -1) {
    if (state.cart[cartIdx].qty + 1 > product.stock) {
      alert('No hay suficiente stock');
      return;
    }
    state.cart[cartIdx].qty++;
  } else {
    state.cart.push({ ...product, qty: 1 });
  }

  showPreview(product);
  renderCart();

  const input = document.getElementById('product-code');
  if (input) {
    input.value = '';
    input.focus();
  }
}

export function changeQty(idx, delta) {
  const item = state.cart[idx];
  const product = state.products.find(p => String(p.code) === String(item.code));

  if (delta > 0 && item.qty + delta > product.stock) {
    alert('Sin stock suficiente');
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) state.cart.splice(idx, 1);
  renderCart();
}

function showPreview(p) {
  const container = document.getElementById('product-preview');
  if (!container) return;
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

export function openPaymentModal() {
  if (!state.cart.length) { alert('El carrito está vacío'); return; }
  const total = document.getElementById('total')?.textContent;
  const method = document.getElementById('payment-method');
  const methodName = method?.options[method.selectedIndex]?.text || '';

  const details = document.getElementById('payment-details');
  if (details) {
    details.innerHTML = `<strong>Total a cobrar: ${total}</strong><br>Medio: ${methodName}`;
  }

  openPopup('payment-modal');
}

export async function confirmPayment() {
  if (!state.cart.length) return;

  const tkCode = 'TK-' + Date.now().toString().slice(-6);
  const total = state.currentCheckout.total;
  const pmSelect = document.getElementById('payment-method');
  const method = pmSelect.options[pmSelect.selectedIndex]?.text || pmSelect.value;

  try {
    // 1. Crear venta
    const venta = await api.createSale({ code: tkCode, total, method }, state.cart);

    // 2. Descontar stock local y remoto
    for (const item of state.cart) {
      const p = state.products.find(prod => prod.id === item.id);
      if (p) {
        p.stock -= item.qty;
        await api.updateStock(p.id, p.stock);
      }
    }

    // 3. Preparar ticket
    const tx = {
      code: tkCode,
      date: new Date().toLocaleString('es-AR'),
      method: method,
      total: total,
      items: [...state.cart],
      breakdown: { ...state.currentCheckout }
    };

    // 4. Limpiar y refrescar
    state.cart = [];
    await api.loadInitialData();
    
    // Mostramos ticket (función global o importada)
    window.showReceipt(tx); 

  } catch (e) {
    console.error('[Cart] Error en checkout:', e);
    alert('Error al procesar el pago. Reintente.');
  }
}

// Attach to window for HTML calls
window.searchProducts = searchProducts;
window.confirmPayment = confirmPayment;
window.finishCheckout = () => { renderAll(); closePopups(); };
