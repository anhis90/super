// ============================================================
// js/app.js
// Punto de entrada principal de la aplicación.
//
// RESPONSABILIDAD:
//   - Declarar el estado global compartido por todos los módulos
//   - Coordinar la inicialización (no tiene lógica de negocio propia)
//   - Llamar a auth.js → db.js → ui.js en el orden correcto
//
// ORDEN DE CARGA DE SCRIPTS (definido en index.html):
//   1. CDN Supabase SDK  → crea window.supabase
//   2. supabase-client.js → crea window.sb (nuestro cliente)
//   3. db.js             → funciones de base de datos
//   4. auth.js           → login/logout/checkSession
//   5. ui.js             → render, popups, navegación
//   6. cart.js           → carrito, checkout, pago
//   7. ai.js             → análisis de negocio
//   8. app.js            → (este archivo) orquestador
//   9. sucursal-guard.js → protección de operaciones sin sucursal
// ============================================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN
//
// Usamos `var` (NO const/let) para garantizar que estas variables
// sean accesibles globalmente desde todos los módulos JS que se
// cargan como scripts independientes (no son módulos ES6).
//
// En una arquitectura futura con bundler (Vite/Webpack) esto se
// reemplazaría por un store centralizado.
// ─────────────────────────────────────────────

var currentUser     = null;   // Usuario logueado { username, role, name, id }
var currentSucursal = null;   // Sucursal activa { id, name, ... } de Supabase

var products     = [];        // Catálogo de productos del sucursal
var suppliers    = [];        // Lista de proveedores
var purchases    = [];        // Historial de compras/ingresos de stock
var promos       = [];        // Promociones tipo "Llevá X, Pagá Y"
var transactions = [];        // Historial de ventas
var paymentRules = [];        // Métodos de pago con sus descuentos
var cart         = [];        // Items en el carrito de venta actual

var ivaConfig   = 21;         // Porcentaje de IVA (se carga desde Supabase)
var openingCash = 0;          // Monto de apertura de caja (se carga desde Supabase)

// ─────────────────────────────────────────────
// INICIO DE LA APLICACIÓN
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initApp();
  // Reloj en tiempo real → updateDate() definida en ui.js
  setInterval(updateDate, 1000);
});

/**
 * initApp()
 * Función principal de arranque. Se ejecuta UNA vez al cargar la página.
 *
 * Flujo:
 * 1. Aplica el tema guardado (dark/light)
 * 2. Verifica si existe sesión guardada en localStorage
 * 3a. Si hay sesión → carga datos de Supabase → muestra la app
 * 3b. Si no hay sesión → muestra pantalla de login
 */
async function initApp() {
  // 1. Restaurar tema antes de mostrar cualquier pantalla
  //    (evita el "flash" de tema incorrecto)
  if (localStorage.getItem('pos_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // 2. Actualizar el reloj una vez inmediato
  if (typeof updateDate === 'function') updateDate();

  // 3. Vincular Enter en el input de código de producto (main POS)
  var codeInput = document.getElementById('product-code');
  if (codeInput) {
    codeInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        // addProductToCart() está definida en cart.js
        addProductToCart(codeInput.value);
      }
    });
  }

  // 4. Verificar si hay sesión local guardada → (definida en auth.js)
  var sessionOk = false;
  try {
    sessionOk = (typeof checkSession === 'function') ? checkSession() : false;
  } catch (e) {
    console.error('[App] Error al verificar sesión:', e);
  }

  if (sessionOk) {
    // ── HAY SESIÓN ACTIVA ───────────────────────────────────────
    // Cargar datos desde Supabase (puede fallar si no hay internet)
    try {
      if (typeof loadInitialData === 'function') {
        await loadInitialData();
      }
    } catch (e) {
      console.warn('[App] Supabase no disponible, continuando en modo offline:', e.message);
    }

    // Si Supabase no tiene sucursal, intentar crear una por defecto
    // para que la app no quede bloqueada al cobrar
    if (!currentSucursal && typeof createSucursalFromForm === 'function') {
      console.log('[App] Sin sucursal activa, creando una por defecto...');
      try {
        await createSucursalFromForm(true); // true = modo silencioso/defecto
      } catch (e) {
        console.warn('[App] No se pudo crear sucursal por defecto:', e);
      }
    }

    // Ejecutar análisis de IA si está disponible
    if (typeof analyzeBusinessData === 'function') {
      analyzeBusinessData();
    }

    // Mostrar la interfaz principal
    if (typeof showMain === 'function') showMain();

  } else {
    // ── SIN SESIÓN → MOSTRAR LOGIN ──────────────────────────────
    if (typeof showLogin === 'function') showLogin();
  }
}

// ─────────────────────────────────────────────
// createSucursalFromForm(useDefault)
// Crea una sucursal si no existe ninguna configurada.
// Llamado automáticamente desde initApp() si Supabase no tiene sucursales.
// También está disponible desde el popup de configuración.
// ─────────────────────────────────────────────
window.createSucursalFromForm = async function (useDefault) {
  var name    = useDefault ? 'Sucursal Principal'    : (document.getElementById('sucursal-name')?.value?.trim()    || 'Sucursal Principal');
  var address = useDefault ? 'Dirección no configurada' : (document.getElementById('sucursal-address')?.value?.trim() || '');

  try {
    var result = await window.sb.from('sucursales').insert([{ name: name, address: address }]).select();

    if (result.error) {
      console.error('[App] Error al crear sucursal:', result.error.message);
      if (!useDefault) alert('Error al crear sucursal: ' + result.error.message);
      return;
    }

    if (result.data && result.data.length > 0) {
      currentSucursal = result.data[0];
      localStorage.setItem('pos_sucursal', JSON.stringify(currentSucursal));
      console.log('[App] Sucursal creada:', currentSucursal.name);
      if (!useDefault) {
        if (typeof closePopups === 'function') closePopups();
        if (typeof loadInitialData === 'function') await loadInitialData();
        if (typeof renderAll === 'function') renderAll();
      }
    }
  } catch (e) {
    console.error('[App] Error inesperado al crear sucursal:', e);
  }
};

// ─────────────────────────────────────────────
// setOpeningCash()
// Establece el monto de apertura de caja.
// Llama a dbSetOpeningCash() definida en db.js.
// ─────────────────────────────────────────────
window.setOpeningCash = async function () {
  var inp = document.getElementById('opening-cash-input-caja');
  if (!inp) return;

  var val = parseFloat(inp.value);
  if (isNaN(val) || val < 0) {
    alert('Ingresá un monto válido para la apertura de caja.');
    return;
  }

  try {
    openingCash = val;
    var error = await dbSetOpeningCash(val); // dbSetOpeningCash() está en db.js
    if (error) {
      alert('Error al guardar la apertura: ' + (error.message || error));
    } else {
      if (typeof renderStats === 'function') renderStats();
      alert('✅ Apertura de caja establecida en $' + val.toFixed(2));
    }
  } catch (e) {
    console.error('[App] Error en setOpeningCash:', e);
    alert('Error inesperado al guardar la apertura de caja.');
  }
};
