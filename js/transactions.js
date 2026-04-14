/*
  js/transactions.js

  Funcionalidad para listar transacciones y anular (void) un ticket.
  - Guarda/lee transacciones desde `localStorage` (clave: 'transactions').
  - Permite marcar una transacción como `cancelled: true` y guarda `cancelledAt`.
  - Si la transacción tiene `items` con `code` y `qty`, restaura stock localmente.
  - Actualiza la tabla `#transactions-table-body` y la tabla de productos (`#product-table-body`) cuando procede.

  Uso:
  - Llamar `voidTransaction(txId)` o usar el botón de la columna Acciones.

*/

(function () {
  'use strict';

  const STORAGE_KEY = 'transactions';

  function tryParseJSON(v) { try { return JSON.parse(v); } catch (e) { return null; } }

  function loadTransactions() {
    if (window.transactions && Array.isArray(window.transactions)) return window.transactions;
    const ls = tryParseJSON(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(ls)) { window.transactions = ls; return ls; }
    window.transactions = [];
    return window.transactions;
  }

  function saveTransactions(arr) {
    window.transactions = arr;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (e) { console.warn('No se pudo guardar transactions en localStorage', e); }
  }

  function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
    const txs = loadTransactions();
    tbody.innerHTML = '';
    txs.forEach(tx => {
      const tr = document.createElement('tr');
      const tdCode = document.createElement('td'); tdCode.innerText = tx.id || (tx.code || '');
      const tdDate = document.createElement('td'); tdDate.innerText = tx.date ? new Date(tx.date).toLocaleString() : '';
      const tdMethod = document.createElement('td'); tdMethod.innerText = tx.method || '';
      const tdTotal = document.createElement('td'); tdTotal.innerText = (typeof tx.total === 'number') ? ('$' + tx.total.toFixed(2)) : (tx.total || '$0.00');
      const tdActions = document.createElement('td'); tdActions.className = 'admin-only';

      // Acciones: anular
      const btn = document.createElement('button'); btn.className = 'action-btn';
      btn.style.background = tx.cancelled ? 'var(--danger-muted)' : '';
      btn.innerHTML = tx.cancelled ? '<i class="ri-close-circle-line"></i>' : '<i class="ri-close-circle-line"></i>';
      btn.title = tx.cancelled ? 'Ticket anulado' : 'Anular ticket';
      btn.onclick = () => { if (!tx.cancelled) voidTransaction(tx.id); else alert('Este ticket ya está anulado.'); };

      tdActions.appendChild(btn);

      if (tx.cancelled) {
        tr.style.opacity = '0.6';
        const badge = document.createElement('span'); badge.innerText = 'ANULADO'; badge.style.color = 'var(--danger)'; badge.style.fontWeight = '700'; badge.style.marginLeft = '8px';
        tdCode.appendChild(badge);
      }

      tr.appendChild(tdCode); tr.appendChild(tdDate); tr.appendChild(tdMethod); tr.appendChild(tdTotal); tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function restoreStockFromTransaction(tx) {
    if (!tx || !Array.isArray(tx.items) || !tx.items.length) return;
    // Try to load products
    let products = (window.products && Array.isArray(window.products)) ? window.products : tryParseJSON(localStorage.getItem('products')) || [];
    let changed = false;
    tx.items.forEach(it => {
      const code = it.code || it.id || it.sku || it.name;
      const qty = Number(it.qty || 0);
      if (!code || !qty) return;
      const idx = products.findIndex(p => p.code === code);
      if (idx >= 0) { products[idx].stock = (Number(products[idx].stock) || 0) + qty; changed = true; }
    });
    if (changed) {
      try { localStorage.setItem('products', JSON.stringify(products)); } catch (e) { console.warn('No se pudo actualizar products en localStorage', e); }
      window.products = products;
      // Actualizar filas DOM en product table si existe
      const tbody = document.getElementById('product-table-body');
      if (tbody) {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.forEach(tr => {
          const tds = tr.querySelectorAll('td');
          const code = tds[0]?.innerText?.trim();
          const prod = products.find(p => p.code === code);
          if (prod) {
            tds[4] && (tds[4].innerText = String(prod.stock || 0));
            const img = tds[1]?.querySelector('img'); if (img) { if (prod.img) { img.src = prod.img; img.style.display='inline-block'; } else { img.style.display='none'; } }
          }
        });
      }
    }
  }

  function voidTransaction(id) {
    if (!id) return alert('ID de transacción inválido');
    const txs = loadTransactions();
    const idx = txs.findIndex(t => t.id === id || t.code === id);
    if (idx < 0) return alert('Transacción no encontrada');
    const tx = txs[idx];
    if (tx.cancelled) return alert('Transacción ya anulada');
    if (!confirm('Confirmar anular ticket ' + (tx.id || tx.code) + ' ?')) return;
    // marcar como anulada
    tx.cancelled = true;
    tx.cancelledAt = new Date().toISOString();
    // restaurar stock si hay items
    try { restoreStockFromTransaction(tx); } catch (e) { console.warn('Error restaurando stock', e); }
    txs[idx] = tx;
    saveTransactions(txs);
    renderTransactionsTable();
    // notificar a IA y a otros módulos
    if (window.analyzeBusinessData) window.analyzeBusinessData();
    alert('Ticket anulado correctamente');
  }

  // Exponer globalmente
  window.voidTransaction = voidTransaction;

  document.addEventListener('DOMContentLoaded', () => {
    renderTransactionsTable();
  });

})();
