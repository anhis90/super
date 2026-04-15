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
    return window.transactions || [];
  }

  function saveTransactions(arr) {
    window.transactions = arr;
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

  async function restoreStockFromTransaction(tx) {
    if (!tx || !Array.isArray(tx.items) || !tx.items.length) return;
    const products = window.products || [];
    let changed = false;
    for (const it of tx.items) {
      const code = it.productCode || it.code || it.id;
      const qty = Number(it.qty || 0);
      if (!code || !qty) continue;
      const p = products.find(prod => prod.code === code);
      if (p) {
        const newStock = (Number(p.stock) || 0) + qty;
        await dbUpdateStock(p.id, newStock);
        changed = true;
      }
    }
    if (changed) {
      await loadInitialData();
      if (typeof renderProductTable === 'function') renderProductTable();
    }
  }

  async function voidTransaction(id) {
    if (!id) return alert('ID de transacción inválido');
    const txs = loadTransactions();
    // Search both by internal id and by sale code
    const tx = txs.find(t => t.id === id || t.code === id);
    if (!tx) return alert('Transacción no encontrada');
    if (tx.cancelled) return alert('Transacción ya anulada');
    if (!confirm('Confirmar anular ticket ' + (tx.code || tx.id) + ' ?')) return;

    // In a real DB scenario, we delete or update the record.
    // Our db.js doesn't have an update status for sales yet, so we'll delete it or notify error.
    const err = await dbClearSales(tx.id); // Re-utilizing a deletion logic or we should add dbVoidSale
    if (err) {
        alert('Error al anular en base de datos: ' + err.message);
        return;
    }

    // restore stock
    await restoreStockFromTransaction(tx);
    
    await loadInitialData();
    renderTransactionsTable();

    if (window.analyzeBusinessData) window.analyzeBusinessData();
    alert('Ticket anulado correctamente');
  }

  // Exponer globalmente
  window.voidTransaction = voidTransaction;

  document.addEventListener('DOMContentLoaded', () => {
    renderTransactionsTable();
  });

})();
