// ============================================================
// js/ai.js
// 🧠 Módulo de Inteligencia de Negocio (IA Simple)
//
// Este módulo analiza las ventas y el stock localmente para ayudar
// a tomar decisiones comerciales sin necesidad de internet (offline-first).
//
// FUNCIONALIDADES:
// 1. 🔥 Alertas de Stock Crítico (Basado en ventas recientes)
// 2. 📊 Top Productos (Hoy y Semana)
// 3. 📦 Recomendaciones de Reposición (Compra inteligente)
// 4. 💰 Detección de Productos sin Movimiento (Stock muerto)
// ============================================================

// ─────────────────────────────────────────────
// ⚙️ CONFIGURACIÓN DE REGLAS
// Modificá estos valores para ajustar qué tan estricta es la "IA"
// ─────────────────────────────────────────────
const AI_CONFIG = {
  STOCK_MINIMO:          5,   // Alertar cuando quede este valor o menos
  DIAS_ANALISIS:         7,   // Ventana de tiempo para rotación (7 días)
  VENTAS_ALTA_ROTACION:  3,   // Cantidad mínima vendida para considerar "alta rotación"
  DIAS_SIN_MOVIMIENTO:   30,  // Avisar si no se vendió nada en un mes
  FACTOR_REPOSICION:     2.0, // Cantidad a comprar = ventas recientes * factor
};

/**
 * analyzeBusinessData()
 * Función central de IA. Recorre productos y ventas para generar 
 * alertas, recomendaciones e insights estratégicos.
 * Se ejecuta automáticamente al cargar la app y tras cada venta.
 */
function analyzeBusinessData() {
  console.log("🧠 IA: Ejecutando análisis de inteligencia de negocio...");

  // Validación de datos: si no hay productos cargados no podemos analizar
  if (!window.products || window.products.length === 0) {
    renderAIInsights(null);
    return;
  }

  // Objeto con todos los resultados del análisis
  const insights = {
    alerts:        calculateStockAlerts(),
    topToday:      calculateTopProducts(1),
    topWeek:       calculateTopProducts(7),
    purchases:     calculatePurchaseRecommendations(),
    stagnant:      calculateStagnantProducts(),
  };

  // 1. Dibujar los resultados en el popup de IA
  renderAIInsights(insights);
  
  // 2. Actualizar los widgets rápidos en el Dashboard
  updateMiniDashboardIA(insights);

  return insights;
}

// ─────────────────────────────────────────────
// 1️⃣ LÓGICA DE ALERTAS DE STOCK (🔥)
// Busca productos con stock bajo que además sean populares.
// ─────────────────────────────────────────────

function calculateStockAlerts() {
  const alerts = [];
  const recentSales = getSalesSinceDays(AI_CONFIG.DIAS_ANALISIS);

  window.products.forEach(p => {
    // Solo analizamos productos con stock igual o menor al mínimo configurado
    if (p.stock <= AI_CONFIG.STOCK_MINIMO) {
      
      // Contamos cuántas unidades se vendieron en los últimos días
      const qtySold = recentSales.reduce((total, sale) => {
        const item = sale.items.find(it => it.productCode === p.code || it.productName === p.name);
        return total + (item ? item.qty : 0);
      }, 0);

      // Si se vende mucho, la alerta es "urgente"
      const isUrgent = qtySold >= AI_CONFIG.VENTAS_ALTA_ROTACION;
      
      alerts.push({
        type: isUrgent ? 'urgente' : 'warning',
        message: isUrgent 
          ? `⚠️ Reponer urgente: <strong>${p.name}</strong> (se vende mucho y queda poco stock)`
          : `⚠️ Stock bajo: ${p.name} (quedan solo ${p.stock} unidades)`,
        importance: isUrgent ? 2 : 1
      });
    }
  });

  // Ordenamos para que las urgentes aparezcan primero
  return alerts.sort((a, b) => b.importance - a.importance);
}

// ─────────────────────────────────────────────
// 2️⃣ LÓGICA DE TOP PRODUCTOS (📊)
// Calcula el ranking de ventas según el rango de días.
// ─────────────────────────────────────────────

function calculateTopProducts(days) {
  const sales = getSalesSinceDays(days);
  const countMap = {};

  sales.forEach(sale => {
    sale.items.forEach(item => {
      const name = item.productName || "Producto Desconocido";
      countMap[name] = (countMap[name] || 0) + item.qty;
    });
  });

  return Object.entries(countMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5); // Retornamos solo el top 5 para no saturar
}

// ─────────────────────────────────────────────
// 3️⃣ LÓGICA DE RECOMENDACIÓN DE COMPRA (📦)
// Sugiere qué comprar basándose en la velocidad de venta.
// ─────────────────────────────────────────────

function calculatePurchaseRecommendations() {
  const recommendations = [];
  const recentSales = getSalesSinceDays(AI_CONFIG.DIAS_ANALISIS);

  window.products.forEach(p => {
    const qtySold = recentSales.reduce((total, sale) => {
      const item = sale.items.find(it => it.productCode === p.code || it.productName === p.name);
      return total + (item ? item.qty : 0);
    }, 0);

    // Sugerencia: Si es de alta rotación y el stock está en zona de riesgo
    if (qtySold >= AI_CONFIG.VENTAS_ALTA_ROTACION && p.stock <= (AI_CONFIG.STOCK_MINIMO * 2)) {
      const suggestedQty = Math.ceil(qtySold * AI_CONFIG.FACTOR_REPOSICION);
      recommendations.push({
        message: `📦 Comprar <strong>${suggestedQty}</strong> unidades de ${p.name} (alta rotación)`
      });
    }
  });

  return recommendations;
}

// ─────────────────────────────────────────────
// 4️⃣ LÓGICA DE PRODUCTOS SIN MOVIMIENTO (💰)
// Detecta productos que ocupan espacio pero no se venden.
// ─────────────────────────────────────────────

function calculateStagnantProducts() {
  const stagnant = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AI_CONFIG.DIAS_SIN_MOVIMIENTO);

  window.products.forEach(p => {
    // Si no hay stock, no es un producto "muerto"
    if (p.stock <= 0) return;

    // Buscamos la fecha de la última venta de este producto
    const lastSale = window.transactions.find(t => {
      const date = t.dateRaw ? new Date(t.dateRaw) : new Date(t.date);
      return t.items.some(it => it.productCode === p.code || it.productName === p.name);
    });

    if (!lastSale) {
      // Caso: El producto nunca se vendió
      stagnant.push(`⚠️ El producto <strong>${p.name}</strong> no registra ventas. Considerar promoción.`);
    } else {
      // Caso: Se vendió, pero hace mucho tiempo
      const saleDate = lastSale.dateRaw ? new Date(lastSale.dateRaw) : new Date(lastSale.date);
      if (saleDate < cutoff) {
        stagnant.push(`⚠️ El producto <strong>${p.name}</strong> no rota, considerar bajar precio.`);
      }
    }
  });

  return stagnant.slice(0, 5);
}

// ─────────────────────────────────────────────
// 🛠️ HELPERS DE DATOS
// ─────────────────────────────────────────────

/**
 * getSalesSinceDays(n) 
 * Filtra el historial global de transacciones por una ventana de tiempo.
 */
function getSalesSinceDays(n) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - n);
  cutoff.setHours(0,0,0,0);

  return (window.transactions || []).filter(t => {
    const d = t.dateRaw ? new Date(t.dateRaw) : new Date(t.date);
    return d >= cutoff;
  });
}

// ─────────────────────────────────────────────
// 🖼️ UI: RENDERIZADO DE RESULTADOS
// ─────────────────────────────────────────────

function renderAIInsights(insights) {
  const container = document.getElementById('ai-insights-container');
  if (!container) return;

  if (!insights) {
    container.innerHTML = '<div class="ai-empty">Esperando datos para el análisis...</div>';
    return;
  }

  let html = '';

  // 1. Alertas Críticas
  if (insights.alerts.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title"><i class="ri-alert-fill"></i> Inteligencia de Stock</h4>
        <ul class="ai-list">
          ${insights.alerts.map(a => `<li class="ai-item ai-item--${a.type}">${a.message}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // 2. Recomendaciones de Compra
  if (insights.purchases.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title"><i class="ri-shopping-cart-fill"></i> Recomendaciones de Reposición</h4>
        <ul class="ai-list">
          ${insights.purchases.map(r => `<li class="ai-item ai-item--rec">${r.message}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // 3. Top Productos de la Semana
  if (insights.topWeek.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title"><i class="ri-medal-fill"></i> Más vendidos (Semana)</h4>
        <div class="ai-list">
          ${insights.topWeek.map((p, i) => `
            <div class="ai-item ai-item--ranked">
              <span class="ai-rank">#${i+1}</span>
              <span class="ai-product-name">${p.name}</span>
              <span class="ai-qty"><strong>${p.qty}</strong> und.</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 4. Stock Muerto
  if (insights.stagnant.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title"><i class="ri-dislike-fill"></i> Alerta de Baja Rotación</h4>
        <ul class="ai-list">
          ${insights.stagnant.map(msg => `<li class="ai-item ai-item--dead">${msg}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Si no hay nada que reportar
  if (html === '') {
    html = `
      <div class="ai-empty">
        <i class="ri-checkbox-circle-fill" style="font-size:40px; color:var(--success); margin-bottom:15px; display:block;"></i>
        ✅ Todo en orden. Tu stock y ventas están balanceados por ahora.
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * updateMiniDashboardIA
 * Actualiza los contadores y listas rápidas en el dashboard principal.
 */
function updateMiniDashboardIA(insights) {
  // Widget de cantidad de alertas
  const miniAlerts = document.getElementById('ai-mini-alerts');
  if (miniAlerts) {
    miniAlerts.textContent = insights.alerts.length;
    miniAlerts.style.color = insights.alerts.length > 0 ? 'var(--danger)' : 'var(--success)';
  }

  // Widget de top hoy
  const miniTopToday = document.getElementById('ai-mini-top-today');
  if (miniTopToday) {
    miniTopToday.innerHTML = insights.topToday.length > 0
      ? insights.topToday.map(p => `<li>${p.name} <small>(${p.qty})</small></li>`).join('')
      : '<li style="list-style:none; opacity:0.6;">Sin ventas</li>';
  }
}
