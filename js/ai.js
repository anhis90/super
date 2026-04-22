/**
 * js/ai.js
 * Módulo de Inteligencia de Negocio (IA).
 */

import { state } from './state.js';

const AI_CONFIG = {
  STOCK_MINIMO: 5,
  DIAS_ANALISIS: 7,
  VENTAS_ALTA_ROTACION: 3,
  DIAS_SIN_MOVIMIENTO: 30,
  FACTOR_REPOSICION: 2.0
};

export function analyzeBusinessData() {
  if (!state.products.length) return null;

  const insights = {
    alerts: calculateStockAlerts(),
    topToday: calculateTopProducts(1),
    topWeek: calculateTopProducts(7),
    purchases: calculatePurchaseRecommendations(),
    stagnant: calculateStagnantProducts(),
  };

  renderAIInsights(insights);
  updateMiniDashboardIA(insights);

  return insights;
}

function calculateStockAlerts() {
  const alerts = [];
  const recentSales = getSalesSinceDays(AI_CONFIG.DIAS_ANALISIS);

  state.products.forEach(p => {
    if (p.stock <= AI_CONFIG.STOCK_MINIMO) {
      const qtySold = recentSales.reduce((total, sale) => {
        const item = sale.items.find(it => it.productCode === p.code || it.productName === p.name);
        return total + (item ? item.qty : 0);
      }, 0);

      const isUrgent = qtySold >= AI_CONFIG.VENTAS_ALTA_ROTACION;
      alerts.push({
        type: isUrgent ? 'urgente' : 'warning',
        message: isUrgent 
          ? `⚠️ Reponer urgente: <strong>${p.name}</strong> (alta rotación)`
          : `⚠️ Stock bajo: ${p.name} (quedan ${p.stock})`,
        importance: isUrgent ? 2 : 1
      });
    }
  });
  return alerts.sort((a, b) => b.importance - a.importance);
}

function calculateTopProducts(days) {
  const sales = getSalesSinceDays(days);
  const countMap = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const name = item.productName || "Producto";
      countMap[name] = (countMap[name] || 0) + item.qty;
    });
  });
  return Object.entries(countMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
}

function calculatePurchaseRecommendations() {
  const recommendations = [];
  const recentSales = getSalesSinceDays(AI_CONFIG.DIAS_ANALISIS);

  state.products.forEach(p => {
    const qtySold = recentSales.reduce((total, sale) => {
      const item = sale.items.find(it => it.productCode === p.code || it.productName === p.name);
      return total + (item ? item.qty : 0);
    }, 0);

    if (qtySold >= AI_CONFIG.VENTAS_ALTA_ROTACION && p.stock <= (AI_CONFIG.STOCK_MINIMO * 2)) {
      const suggestedQty = Math.ceil(qtySold * AI_CONFIG.FACTOR_REPOSICION);
      recommendations.push({ message: `📦 Comprar <strong>${suggestedQty}</strong> de ${p.name}` });
    }
  });
  return recommendations;
}

function calculateStagnantProducts() {
  const stagnant = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AI_CONFIG.DIAS_SIN_MOVIMIENTO);

  state.products.forEach(p => {
    if (p.stock <= 0) return;
    const lastSale = state.transactions.find(t => 
      t.items.some(it => it.productCode === p.code || it.productName === p.name)
    );
    if (!lastSale || new Date(lastSale.date) < cutoff) {
      stagnant.push(`⚠️ <strong>${p.name}</strong> no rota. Considerar oferta.`);
    }
  });
  return stagnant.slice(0, 5);
}

function getSalesSinceDays(n) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - n);
  return state.transactions.filter(t => new Date(t.date) >= cutoff);
}

function renderAIInsights(insights) {
  const container = document.getElementById('ai-insights-container');
  if (!container) return;

  let html = '';
  if (insights.alerts.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Stock</h4><ul class="ai-list">${insights.alerts.map(a => `<li class="ai-item ai-item--${a.type}">${a.message}</li>`).join('')}</ul></div>`;
  }
  if (insights.purchases.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Compras</h4><ul class="ai-list">${insights.purchases.map(r => `<li class="ai-item ai-item--rec">${r.message}</li>`).join('')}</ul></div>`;
  }
  container.innerHTML = html || '<div class="ai-empty">Todo al día.</div>';
}

function updateMiniDashboardIA(insights) {
  const el = document.getElementById('ai-mini-alerts');
  if (el) el.textContent = insights.alerts.length;
}

window.analyzeBusinessData = analyzeBusinessData;
