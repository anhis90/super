/*
  js/ai.js

  Módulo sencillo de "IA" local para el POS.
  - No usa APIs externas.
  - Analiza datos locales (globales o localStorage o tablas DOM) y genera:
    * alertas de stock
    * top productos (hoy / semana)
    * recomendaciones de compra
    * productos sin movimiento

  Cómo funciona:
  - `analyzeBusinessData()` recorre productos y ventas y actualiza el UI.
  - Colección de datos buscada (por orden): `window.products`, `window.transactions`,
    `localStorage.transactions`, tablas DOM `#product-table-body`, `#transactions-table-body`.

  Para adaptar reglas (por ejemplo stock mínimo, días): modificar las constantes
  STOCK_MIN, ANALYSIS_DAYS, NO_MOVE_DAYS o actualizar los elementos del DOM:
  - `#ai-cfg-stock` (stock mínimo)
  - `#ai-cfg-dias` (días de análisis)
  - `#ai-cfg-dead` (días sin movimiento)

  Exposición:
  - `window.analyzeBusinessData()` para forzar un re-análisis desde otras partes.
  - `window.ai = { hookSaleRecorded: fn }` para llamar cuando se confirme una venta.

*/

(function () {
  'use strict';

  // ----- Configuraciones (fáciles de cambiar) -----
  let STOCK_MIN = 5;         // stock mínimo por defecto
  let ANALYSIS_DAYS = 7;     // ventana de análisis para rotación
  let NO_MOVE_DAYS = 30;     // sin movimiento -> considerar bajar precio

  // Umbrales adicionales
  const HIGH_ROTATION_THRESHOLD = 5; // unidades vendidas en ANALYSIS_DAYS para considerar "alta rotación"

  // ----- Helpers para lectura de datos -----
  function tryParseJSON(v) {
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  // Intentar obtener productos desde distintas fuentes
  function getProducts() {
    if (window.products && Array.isArray(window.products)) return window.products;

    // localStorage fallback
    const ls = tryParseJSON(localStorage.getItem('products'));
    if (Array.isArray(ls)) return ls;

    // Intentar leer la tabla DOM (#product-table-body)
    const tbody = document.getElementById('product-table-body');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const products = rows.map(tr => {
        const tds = tr.querySelectorAll('td');
        return {
          code: tds[0]?.innerText?.trim() || '',
          img: tds[1]?.querySelector('img')?.src || '',
          name: tds[2]?.innerText?.trim() || '',
          price: parseFloat((tds[3]?.innerText || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0,
          stock: parseInt(tds[4]?.innerText?.trim()) || 0
        };
      });
      if (products.length) return products;
    }

    return [];
  }

  // Intentar obtener transacciones/ventas
  // Espera arrays donde cada transacción puede tener {id,date,items:[{code,name,qty}], total}
  function getTransactions() {
    if (window.transactions && Array.isArray(window.transactions)) return window.transactions;
    if (window.sales && Array.isArray(window.sales)) return window.sales;

    const ls = tryParseJSON(localStorage.getItem('transactions')) || tryParseJSON(localStorage.getItem('sales'));
    if (Array.isArray(ls)) return ls;

    // Intento leer la tabla de transacciones (si existe)
    const tbody = document.getElementById('transactions-table-body');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      // No todas las implementaciones incluyen items; aquí se crean entradas resumidas
      const txs = rows.map(tr => {
        const tds = tr.querySelectorAll('td');
        const code = tds[0]?.innerText?.trim() || '';
        const dateText = tds[1]?.innerText?.trim() || '';
        const date = new Date(dateText || Date.now()).toISOString();
        const total = parseFloat((tds[3]?.innerText || '').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
        return { id: code + '_' + date, date, total, items: [] };
      });
      if (txs.length) return txs;
    }

    return [];
  }

  function parseISO(d) {
    const dd = new Date(d);
    return isNaN(dd) ? new Date() : dd;
  }

  function daysAgo(dateStr) {
    const d = parseISO(dateStr);
    const ms = Date.now() - d.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  function formatCurrency(v) {
    return isNaN(v) ? '$0.00' : '$' + v.toFixed(2);
  }

  // ----- Lógica de análisis -----
  function computeTopProducts(transactions, days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const counter = {}; // code -> {name, qty}

    transactions.forEach(tx => {
      const txDate = parseISO(tx.date).getTime();
      if (txDate < cutoff) return;
      const items = Array.isArray(tx.items) ? tx.items : [];
      items.forEach(it => {
        const code = it.code || it.id || it.sku || it.name;
        if (!code) return;
        counter[code] = counter[code] || { name: it.name || code, qty: 0 };
        counter[code].qty += Number(it.qty || 0);
      });
    });

    const arr = Object.keys(counter).map(k => ({ code: k, name: counter[k].name, qty: counter[k].qty }));
    arr.sort((a, b) => b.qty - a.qty);
    return arr;
  }

  function detectLowStock(products, txsInPeriod) {
    // txsInPeriod: map code -> qty sold in period
    const alerts = [];
    products.forEach(p => {
      const sold = txsInPeriod[p.code] || 0;
      if ((p.stock || 0) <= STOCK_MIN) {
        const msg = `⚠️ Reponer urgente: ${p.name} (se vende ${sold} en últimos ${ANALYSIS_DAYS}d y queda ${p.stock || 0} unidades)`;
        alerts.push({ product: p, reason: 'low_stock', message: msg, sold });
      }
    });
    return alerts;
  }

  function recommendPurchases(products, txCountMap) {
    const recs = [];
    products.forEach(p => {
      const sold = txCountMap[p.code] || 0;
      if (sold >= HIGH_ROTATION_THRESHOLD && (p.stock || 0) <= STOCK_MIN) {
        const suggested = Math.max(Math.ceil(sold * 1.5), 5);
        const message = `Comprar ${suggested} unidades de ${p.name} (alta rotación: ${sold} vendidas en ${ANALYSIS_DAYS} días)`;
        recs.push({ product: p, suggested, message });
      }
    });
    return recs;
  }

  function detectNoMovement(products, transactions) {
    const lastSaleByCode = {}; // code -> lastDate
    transactions.forEach(tx => {
      const date = parseISO(tx.date).toISOString();
      const items = Array.isArray(tx.items) ? tx.items : [];
      items.forEach(it => {
        const code = it.code || it.id || it.sku || it.name;
        if (!code) return;
        const prev = lastSaleByCode[code];
        if (!prev || new Date(date) > new Date(prev)) lastSaleByCode[code] = date;
      });
    });

    const dead = [];
    products.forEach(p => {
      const last = lastSaleByCode[p.code];
      if (!last) {
        // Nunca vendido
        dead.push({ product: p, days: null, message: `⚠️ ${p.name} no tiene ventas registradas. Considerar promoción.` });
      } else {
        const d = daysAgo(last);
        if (d >= NO_MOVE_DAYS) {
          dead.push({ product: p, days: d, message: `⚠️ ${p.name} no se vende desde hace ${d} días. Considerar bajar precio.` });
        }
      }
    });
    return dead;
  }

  // ----- Renderizado UI -----
  function renderInsights(insights) {
    const container = document.getElementById('ai-insights-container');
    if (!container) return;
    container.innerHTML = ''; // limpiamos

    // Alertas urgentes
    if (insights.alerts.length) {
      const ul = document.createElement('ul');
      ul.style.paddingLeft = '18px';
      insights.alerts.forEach(a => {
        const li = document.createElement('li');
        li.style.marginBottom = '8px';
        li.innerText = a.message;
        ul.appendChild(li);
      });
      const h = document.createElement('h3'); h.innerText = 'Alertas';
      container.appendChild(h);
      container.appendChild(ul);
    } else {
      const p = document.createElement('p'); p.innerText = 'No hay alertas.'; container.appendChild(p);
    }

    // Recomendaciones de compra
    if (insights.recommendations.length) {
      const h = document.createElement('h3'); h.innerText = 'Recomendaciones de Compra';
      container.appendChild(h);
      const ul = document.createElement('ul'); ul.style.paddingLeft = '18px';
      insights.recommendations.forEach(r => {
        const li = document.createElement('li'); li.innerText = r.message; ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Productos sin movimiento
    if (insights.deadProducts.length) {
      const h = document.createElement('h3'); h.innerText = 'Productos sin movimiento';
      container.appendChild(h);
      const ul = document.createElement('ul'); ul.style.paddingLeft = '18px';
      insights.deadProducts.forEach(d => {
        const li = document.createElement('li'); li.innerText = d.message; ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Top productos (hoy / semana)
    const hTop = document.createElement('h3'); hTop.innerText = 'Top productos'; container.appendChild(hTop);
    const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.gap = '16px';

    const makeList = (arr, title) => {
      const box = document.createElement('div'); box.style.flex = '1';
      const t = document.createElement('p'); t.style.color = 'var(--text-muted)'; t.innerText = title; box.appendChild(t);
      const ul = document.createElement('ul'); ul.style.paddingLeft = '18px';
      arr.slice(0, 6).forEach(i => { const li = document.createElement('li'); li.innerText = `${i.name} — ${i.qty}`; ul.appendChild(li); });
      box.appendChild(ul);
      return box;
    };

    wrap.appendChild(makeList(insights.topToday, 'Hoy'));
    wrap.appendChild(makeList(insights.topWeek, 'Semana'));
    container.appendChild(wrap);
  }

  // ----- Función central expuesta -----
  async function analyzeBusinessData() {
    // Actualizar configuración desde UI si existe
    const cfgStock = parseInt(document.getElementById('ai-cfg-stock')?.innerText || STOCK_MIN);
    const cfgDias = parseInt(document.getElementById('ai-cfg-dias')?.innerText || ANALYSIS_DAYS);
    const cfgDead = parseInt(document.getElementById('ai-cfg-dead')?.innerText || NO_MOVE_DAYS);
    STOCK_MIN = isNaN(cfgStock) ? STOCK_MIN : cfgStock;
    ANALYSIS_DAYS = isNaN(cfgDias) ? ANALYSIS_DAYS : cfgDias;
    NO_MOVE_DAYS = isNaN(cfgDead) ? NO_MOVE_DAYS : cfgDead;

    const products = getProducts();
    const transactions = getTransactions();

    // Map de ventas por producto en ventana ANALYSIS_DAYS
    const cutoff = Date.now() - (ANALYSIS_DAYS * 24 * 60 * 60 * 1000);
    const txCountMap = {}; // code -> qty
    transactions.forEach(tx => {
      const tdate = parseISO(tx.date).getTime();
      if (tdate < cutoff) return;
      const items = Array.isArray(tx.items) ? tx.items : [];
      items.forEach(it => {
        const code = it.code || it.id || it.sku || it.name;
        if (!code) return;
        txCountMap[code] = (txCountMap[code] || 0) + Number(it.qty || 0);
      });
    });

    const topToday = computeTopProducts(transactions, 1);
    const topWeek = computeTopProducts(transactions, 7);

    const alerts = detectLowStock(products, txCountMap);
    const recommendations = recommendPurchases(products, txCountMap);
    const deadProducts = detectNoMovement(products, transactions);

    const insights = { alerts, recommendations, deadProducts, topToday, topWeek };

    // Actualizar UI
    renderInsights(insights);

    // Mini panel updates
    const aiAlertsElem = document.getElementById('ai-mini-alerts');
    if (aiAlertsElem) aiAlertsElem.innerText = String(alerts.length || 0);
    const aiTopToday = document.getElementById('ai-mini-top-today');
    if (aiTopToday) {
      aiTopToday.innerHTML = '';
      topToday.slice(0,5).forEach(i => { const li = document.createElement('li'); li.innerText = `${i.name} (${i.qty})`; aiTopToday.appendChild(li); });
    }

    // Dashboard main updates (si existen elementos)
    const lowStockCountElem = document.getElementById('dashboard-low-stock');
    if (lowStockCountElem) lowStockCountElem.innerText = String(alerts.length || 0);

    const topProductsList = document.getElementById('top-products-list');
    if (topProductsList) {
      topProductsList.innerHTML = '';
      topWeek.slice(0,8).forEach(p => { const li = document.createElement('li'); li.innerText = `${p.name} — ${p.qty}`; topProductsList.appendChild(li); });
    }

    return insights;
  }

  // ----- Integración / Observadores -----
  // Exponer función global
  window.analyzeBusinessData = analyzeBusinessData;

  // Hook que otras partes del app pueden llamar después de registrar una venta
  window.ai = window.ai || {};
  window.ai.hookSaleRecorded = function (sale) {
    // sale puede ser el objeto de la transacción recién creada
    // Se recomienda que quien registra la venta haga: window.ai.hookSaleRecorded(tx);
    // Simplemente re-analizamos (puede optimizarse si se necesita)
    try { analyzeBusinessData(); } catch (e) { console.error('AI hook error', e); }
  };

  // Observador DOM: si cambian tablas de transacciones o productos, re-analizar
  function observeTable(id) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const mo = new MutationObserver(() => { analyzeBusinessData(); });
      mo.observe(el, { childList: true, subtree: true });
    } catch (e) { /* no crítico */ }
  }
  document.addEventListener('DOMContentLoaded', () => {
    // Pequeño retraso para que otros módulos terminen de inicializar
    setTimeout(() => { analyzeBusinessData(); }, 600);
    observeTable('transactions-table-body');
    observeTable('product-table-body');
  });

  // También tratar de reaccionar a cambios en localStorage (si la app guarda ahí)
  window.addEventListener('storage', (e) => {
    if (e.key && (e.key.includes('transactions') || e.key.includes('products') || e.key.includes('sales'))) {
      analyzeBusinessData();
    }
  });

  // Exponer algunas constantes para que el usuario pueda modificarlas desde consola
  window.aiConfig = {
    setStockMin(v) { STOCK_MIN = Number(v); document.getElementById('ai-cfg-stock') && (document.getElementById('ai-cfg-stock').innerText = String(STOCK_MIN)); },
    setAnalysisDays(v) { ANALYSIS_DAYS = Number(v); document.getElementById('ai-cfg-dias') && (document.getElementById('ai-cfg-dias').innerText = String(ANALYSIS_DAYS)); },
    setNoMoveDays(v) { NO_MOVE_DAYS = Number(v); document.getElementById('ai-cfg-dead') && (document.getElementById('ai-cfg-dead').innerText = String(NO_MOVE_DAYS)); }
  };

})();
// ============================================================
// js/ai.js
// 🧠 Módulo de Inteligencia de Negocio
//
// Analiza productos y ventas existentes para generar:
//   - Alertas de stock crítico
//   - Top productos (hoy y semana)
//   - Recomendaciones de compra
//   - Alertas de productos sin movimiento
//
// NO usa APIs externas. Funciona 100% offline.
// Todo el análisis usa los arrays globales: products, transactions
// ============================================================


// ─────────────────────────────────────────────
// ⚙️ CONFIGURACIÓN DE REGLAS
// Modificá estos valores para ajustar el comportamiento:
// ─────────────────────────────────────────────
const AI_CONFIG = {
  STOCK_MINIMO:          5,   // 🔴 Stock <= este valor → alerta de stock bajo
  DIAS_ANALISIS:         7,   // 📅 Días hacia atrás para analizar ventas recientes
  VENTAS_ALTA_ROTACION:  3,   // 🔥 Unidades vendidas en el período = "alta rotación"
  DIAS_SIN_MOVIMIENTO:   30,  // 🪦 Sin ventas en estos días → producto "muerto"
  FACTOR_REPOSICION:     2,   // 📦 Multiplicador para calcular cuánto reponer
};


// ─────────────────────────────────────────────
// 🎯 FUNCIÓN CENTRAL: analyzeBusinessData()
// ─────────────────────────────────────────────

/**
 * analyzeBusinessData()
 * Punto de entrada del módulo de IA.
 * Coordina todos los análisis y renderiza los resultados en la UI.
 *
 * Se llama automáticamente después de:
 *   - Cargar datos iniciales (initApp)
 *   - Registrar una nueva venta (confirmPayment)
 */
function analyzeBusinessData() {
  // Si no hay datos suficientes, mostrar estado vacío y salir
  if (!products.length && !transactions.length) {
    renderAIInsights(null);
    return;
  }

  // Ejecutar todos los análisis y agrupar resultados
  const insights = {
    stockAlerts:      getStockAlerts(),
    topProductsToday: getTopProducts(1),
    topProductsWeek:  getTopProducts(7),
    purchaseRecs:     getPurchaseRecommendations(),
    deadStock:        getDeadStockAlerts(),
  };

  // Renderizar en la UI
  renderAIInsights(insights);

  // Retornar por si otro módulo necesita los datos
  return insights;
}


// ─────────────────────────────────────────────
// 1️⃣ ALERTAS DE STOCK BAJO
// ─────────────────────────────────────────────

/**
 * getStockAlerts()
 * Detecta productos con stock <= AI_CONFIG.STOCK_MINIMO.
 * Prioriza como "urgente" los que ADEMÁS tienen alta rotación reciente
 * (es decir, se venden mucho pero queda poco).
 *
 * Para modificar el umbral de stock: cambiá AI_CONFIG.STOCK_MINIMO
 * Para modificar el umbral de "alta rotación": cambiá AI_CONFIG.VENTAS_ALTA_ROTACION
 */
function getStockAlerts() {
  const alerts       = [];
  const ventasRecientes = getSalesInLastDays(AI_CONFIG.DIAS_ANALISIS);

  products.forEach(product => {
    if (product.stock > AI_CONFIG.STOCK_MINIMO) return; // Stock OK, skip

    // Contar cuántas unidades de este producto se vendieron recientemente
    const unidadesVendidas = ventasRecientes
      .flatMap(t => t.items)
      .filter(i => i.productName === product.name || i.productCode === product.code)
      .reduce((sum, i) => sum + i.qty, 0);

    // Si vendió mucho y tiene poco stock → urgente
    const esUrgente = unidadesVendidas >= AI_CONFIG.VENTAS_ALTA_ROTACION;

    alerts.push({
      type:     esUrgente ? 'urgente' : 'warning',
      product:  product.name,
      stock:    product.stock,
      vendidos: unidadesVendidas,
      message:  esUrgente
        ? `Reponer urgente: <strong>${product.name}</strong> — ${product.stock} en stock y vendió ${unidadesVendidas} und. esta semana`
        : `Stock bajo: <strong>${product.name}</strong> — solo quedan ${product.stock} unidades`,
    });
  });

  // Ordenar: urgentes primero
  return alerts.sort((a, b) => a.type === 'urgente' ? -1 : 1);
}


// ─────────────────────────────────────────────
// 2️⃣ TOP PRODUCTOS MÁS VENDIDOS
// ─────────────────────────────────────────────

/**
 * getTopProducts(days)
 * Calcula los productos más vendidos en los últimos X días.
 * Devuelve un array ordenado de mayor a menor, máximo 5 items.
 *
 * @param {number} days - Cuántos días hacia atrás analizar (1 = hoy, 7 = semana)
 */
function getTopProducts(days) {
  const ventasRecientes = getSalesInLastDays(days);
  const conteo = {}; // { "nombre producto": totalUnidades }

  ventasRecientes.forEach(t => {
    t.items.forEach(item => {
      const key = item.productName;
      conteo[key] = (conteo[key] || 0) + item.qty;
    });
  });

  // Convertir a array, ordenar y tomar los 5 primeros
  return Object.entries(conteo)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
}


// ─────────────────────────────────────────────
// 3️⃣ RECOMENDACIONES DE COMPRA (REPOSICIÓN)
// ─────────────────────────────────────────────

/**
 * getPurchaseRecommendations()
 * Analiza ventas recientes y stock actual.
 * Si un producto tiene alta rotación y stock bajo → sugiere una cantidad a comprar.
 *
 * Fórmula de reposición:
 *   promedioDiario = totalVendido / diasAnalizados
 *   stockRecomendado = promedioDiario * diasAnalizados * FACTOR_REPOSICION
 *   cantidadAComprar = stockRecomendado - stockActual
 *
 * Para modificar: AI_CONFIG.FACTOR_REPOSICION (mayor = sugerir más stock)
 */
function getPurchaseRecommendations() {
  const recs            = [];
  const ventasRecientes = getSalesInLastDays(AI_CONFIG.DIAS_ANALISIS);

  // Sumar ventas por nombre de producto
  const ventasPorProducto = {};
  ventasRecientes.forEach(t => {
    t.items.forEach(item => {
      ventasPorProducto[item.productName] = (ventasPorProducto[item.productName] || 0) + item.qty;
    });
  });

  // Analizar cada producto con ventas en el período
  Object.entries(ventasPorProducto).forEach(([nombre, totalVendido]) => {
    // Solo recomendar si es "alta rotación"
    if (totalVendido < AI_CONFIG.VENTAS_ALTA_ROTACION) return;

    const product = products.find(p => p.name === nombre);
    if (!product) return;

    // Calcular cuánto reponer
    const promedioDiario    = totalVendido / AI_CONFIG.DIAS_ANALISIS;
    const stockRecomendado  = Math.ceil(promedioDiario * AI_CONFIG.DIAS_ANALISIS * AI_CONFIG.FACTOR_REPOSICION);
    const cantidadAComprar  = Math.max(0, stockRecomendado - product.stock);

    if (cantidadAComprar <= 0) return; // El stock es suficiente

    recs.push({
      product:       product.name,
      stockActual:   product.stock,
      cantidadSugerida: cantidadAComprar,
      vendidos:      totalVendido,
      message: `Comprar ~<strong>${cantidadAComprar} und.</strong> de ${product.name} (${totalVendido} vendidas en ${AI_CONFIG.DIAS_ANALISIS} días, stock actual: ${product.stock})`,
    });
  });

  // Ordenar por mayor rotación
  return recs.sort((a, b) => b.vendidos - a.vendidos);
}


// ─────────────────────────────────────────────
// 4️⃣ PRODUCTOS SIN MOVIMIENTO (STOCK MUERTO)
// ─────────────────────────────────────────────

/**
 * getDeadStockAlerts()
 * Detecta productos que tienen stock disponible pero NO se vendieron
 * en los últimos AI_CONFIG.DIAS_SIN_MOVIMIENTO días.
 *
 * Riesgo: capital inmovilizado. Acción recomendada: promociones o bajar precio.
 *
 * Para modificar el período: cambiá AI_CONFIG.DIAS_SIN_MOVIMIENTO
 */
function getDeadStockAlerts() {
  const alerts          = [];
  const ventasRecientes = getSalesInLastDays(AI_CONFIG.DIAS_SIN_MOVIMIENTO);

  // Conjunto de nombres de productos que SÍ se vendieron recientemente
  const productosVendidos = new Set(
    ventasRecientes.flatMap(t => t.items.map(i => i.productName))
  );

  // Detectar los que tienen stock pero no rotaron
  products.forEach(product => {
    if (product.stock <= 0) return; // Sin stock, no aplica
    if (productosVendidos.has(product.name)) return; // Se vendió recientemente, OK

    alerts.push({
      product: product.name,
      stock:   product.stock,
      message: `<strong>${product.name}</strong> — sin ventas en ${AI_CONFIG.DIAS_SIN_MOVIMIENTO} días (stock: ${product.stock}). Considerá hacer una promoción o bajar el precio.`,
    });
  });

  return alerts;
}


// ─────────────────────────────────────────────
// 🛠️ HELPER: getSalesInLastDays()
// ─────────────────────────────────────────────

/**
 * getSalesInLastDays(days)
 * Filtra el array global `transactions` para obtener solo
 * las ventas de los últimos X días.
 *
 * Usa `t.dateRaw` (objeto Date guardado en db.js) para máxima precisión.
 * Si no existe, intenta parsear `t.date` como fallback.
 *
 * @param {number} days - Número de días hacia atrás a incluir
 * @returns {Array} - Transacciones dentro del período
 */
function getSalesInLastDays(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0); // Inicio del día X días atrás

  return transactions.filter(t => {
    // Preferir dateRaw (Date object exacto) sobre el string formateado
    const fecha = t.dateRaw ? new Date(t.dateRaw) : new Date(t.date);
    return !isNaN(fecha) && fecha >= cutoff;
  });
}


// ─────────────────────────────────────────────
// 🖼️ RENDERIZADO EN LA UI
// ─────────────────────────────────────────────

/**
 * renderAIInsights(insights)
 * Dibuja todos los análisis dentro del contenedor #ai-insights-container.
 * Si insights es null → muestra estado vacío.
 *
 * @param {Object|null} insights - Resultado de analyzeBusinessData()
 */
function renderAIInsights(insights) {
  const container = document.getElementById('ai-insights-container');
  if (!container) return;

  // Sin datos aún
  if (!insights) {
    container.innerHTML = `
      <div class="ai-empty">
        <div style="font-size:48px; margin-bottom:12px;">📊</div>
        <p>Sin datos suficientes para analizar.</p>
        <p style="color:var(--text-muted); font-size:13px; margin-top:6px;">
          Registrá ventas para ver recomendaciones automáticas.
        </p>
      </div>
    `;
    return;
  }

  const { stockAlerts, topProductsToday, topProductsWeek, purchaseRecs, deadStock } = insights;
  let html = '';

  // ── Sección: Alertas de Stock ──────────────────
  if (stockAlerts.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title">⚠️ Alertas de Stock</h4>
        <ul class="ai-list">
          ${stockAlerts.map(a => `
            <li class="ai-item ai-item--${a.type}">
              ${a.type === 'urgente' ? '⚡' : '⚠️'} ${a.message}
            </li>
          `).join('')}
        </ul>
      </div>`;
  }

  // ── Sección: Recomendaciones de Compra ─────────
  if (purchaseRecs.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title">🛒 Recomendaciones de Compra</h4>
        <ul class="ai-list">
          ${purchaseRecs.map(r => `
            <li class="ai-item ai-item--rec">
              📦 ${r.message}
            </li>
          `).join('')}
        </ul>
      </div>`;
  }

  // ── Sección: Top Productos Hoy ─────────────────
  if (topProductsToday.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title">🔥 Más vendidos hoy</h4>
        <ol class="ai-list">
          ${topProductsToday.map((p, i) => `
            <li class="ai-item ai-item--ranked">
              <span class="ai-rank">#${i + 1}</span>
              <span class="ai-product-name">${p.name}</span>
              <strong class="ai-qty">${p.qty} und.</strong>
            </li>
          `).join('')}
        </ol>
      </div>`;
  }

  // ── Sección: Top Productos Semana ──────────────
  if (topProductsWeek.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title">📈 Más vendidos esta semana</h4>
        <ol class="ai-list">
          ${topProductsWeek.map((p, i) => `
            <li class="ai-item ai-item--ranked">
              <span class="ai-rank">#${i + 1}</span>
              <span class="ai-product-name">${p.name}</span>
              <strong class="ai-qty">${p.qty} und.</strong>
            </li>
          `).join('')}
        </ol>
      </div>`;
  }

  // ── Sección: Stock sin movimiento ──────────────
  if (deadStock.length > 0) {
    html += `
      <div class="ai-section">
        <h4 class="ai-section-title">🪦 Sin movimiento (${AI_CONFIG.DIAS_SIN_MOVIMIENTO} días)</h4>
        <ul class="ai-list">
          ${deadStock.map(d => `
            <li class="ai-item ai-item--dead">
              🪦 ${d.message}
            </li>
          `).join('')}
        </ul>
      </div>`;
  }

  // Si no hay ningún insight que mostrar
  if (!html) {
    html = `
      <div class="ai-empty">
        <div style="font-size:48px; margin-bottom:12px;">✅</div>
        <p>¡Todo en orden! No hay alertas en este momento.</p>
      </div>`;
  }

  container.innerHTML = html;
}
