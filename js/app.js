// ============================================================
// js/app.js
// Punto de entrada principal de la aplicación.
// Coordina la inicialización, sin lógica de negocio propia.
// ============================================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN
// Estas variables son compartidas por todos los módulos JS
// ─────────────────────────────────────────────

let currentUser    = null;   // Usuario logueado { username, role }
let currentSucursal = null;  // Sucursal activa de la base de datos

let products     = [];       // Lista de productos
let suppliers    = [];       // Lista de proveedores
let purchases    = [];       // Lista de compras
let promos       = [];       // Promociones (Llevá X, Pagá Y)
let transactions = [];       // Historial de ventas
let paymentRules = [];       // Métodos de pago con descuentos
let cart         = [];       // Items en el carrito actual

let ivaConfig   = 21;        // Porcentaje de IVA (se carga desde config en DB)
let openingCash = 0;         // Monto de apertura de caja

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
  const sessionOk = checkSession();

  if (sessionOk) {
    // Hay sesión activa — cargar datos y abrir la app
    await loadInitialData(); // función en db.js
    showMain();              // función en ui.js
  } else {
    // Sin sesión — mostrar pantalla de login
    showLogin(); // función en ui.js
  }
}
