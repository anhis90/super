// ============================================================
// js/app.js
// Punto de entrada principal de la aplicación.
// Coordina la inicialización, sin lógica de negocio propia.
// ============================================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN
// Estas variables son compartidas por todos los módulos JS.
// Usamos 'var' para asegurar que sean globales y accesibles en window.
// ─────────────────────────────────────────────

var currentUser    = null;   // Usuario logueado { username, role }
var currentSucursal = null;  // Sucursal activa de la base de datos

var products     = [];       // Lista de productos
var suppliers    = [];       // Lista de proveedores
var purchases    = [];       // Lista de compras
var promos       = [];       // Promociones (Llevá X, Pagá Y)
var transactions = [];       // Historial de ventas
var paymentRules = [];       // Métodos de pago con descuentos
var cart         = [];       // Items en el carrito actual

var ivaConfig   = 21;        // Porcentaje de IVA (se carga desde config en DB)
var openingCash = 0;         // Monto de apertura de caja

// ─────────────────────────────────────────────
// INICIO DE LA APLICACIÓN
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setInterval(updateDate, 1000); // Reloj en tiempo real
});

/**
 * initApp()
 * Función principal de inicio.
 * 1. Aplica el tema guardado (dark/light)
 * 2. Verifica si hay sesión guardada en localStorage
 * 3. Si hay sesión → carga datos y muestra la app
 * 4. Si no hay sesión → muestra pantalla de login
 */
async function initApp() {
  updateDate();

  // Restaurar tema de la última sesión
  if (localStorage.getItem('pos_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // Vincular Enter en el input de código de producto
  const codeInput = document.getElementById('product-code');
  if (codeInput) {
    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addProductToCart(codeInput.value);
    });
  }

  // Verificar sesión guardada (función definida en auth.js)
  const sessionOk = await checkSession();

  if (sessionOk) {
    // Hay sesión activa — cargar datos y abrir la app
    try {
      await loadInitialData(); // función en db.js
    } catch (e) {
      console.warn('Error en carga inicial (Supabase):', e);
    }

    // Fallback: si no hay productos (o falló Supabase), cargar modo local
    if ((!window.products || window.products.length === 0) && typeof loadProducts === 'function') {
      console.log('Cargando productos desde modo local...');
      loadProducts();
    }

    // Garantizar que siempre haya una sucursal activa para no bloquear el cobro
    if (!window.currentSucursal && typeof createSucursalFromForm === 'function') {
      console.log('Creando sucursal por defecto para evitar bloqueos...');
      await createSucursalFromForm(true); // Crear por defecto silenciosamente
    }

    if (typeof analyzeBusinessData === 'function') analyzeBusinessData();
    showMain();              // función en ui.js
  } else {
    // Sin sesión — mostrar pantalla de login
    showLogin(); // función en ui.js
  }
}
