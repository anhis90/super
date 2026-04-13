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
