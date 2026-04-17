// ============================================================
// js/app.js
// Orquestador principal de la aplicación.
//
// RESPONSABILIDAD DE ESTE ARCHIVO:
//   - Arrancar la app al cargar la página (initApp)
//   - Coordinar auth → datos → UI en el orden correcto
//   - Exponer helpers globales que necesitan el DOM: 
//     createSucursalFromForm, setOpeningCash
//
// LO QUE NO HACE ESTE ARCHIVO:
//   - No declara estado global (eso está en state.js)
//   - No hace llamadas a Supabase directamente (eso es db.js)
//   - No renderiza HTML (eso es ui.js)
//   - No valida login (eso es auth.js)
//
// ORDEN DE CARGA (definido en index.html):
//   head: CDN Supabase
//   defer 1: supabase-client.js  → window.sb
//   defer 2: state.js            → variables globales
//   defer 3: db.js               → funciones de datos
//   defer 4: auth.js             → login/logout/checkSession
//   defer 5: ui.js               → render y navegación
//   defer 6: cart.js             → carrito y checkout
//   defer 7: ai.js               → análisis de negocio
//   defer 8: app.js              → (este archivo) arranque
//   defer 9: sucursal-guard.js   → protecciones runtime
// ============================================================

// ─────────────────────────────────────────────
// ARRANQUE: esperar al DOM antes de inicializar
// DOMContentLoaded se dispara DESPUÉS de que todos
// los scripts defer se ejecutaron → no hay conflicto.
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  initApp();
  setInterval(updateDate, 1000); // Reloj en tiempo real (updateDate definida en ui.js)
});

// ─────────────────────────────────────────────
// initApp()
// Función de arranque — se ejecuta UNA SOLA VEZ.
//
// Flujo:
// 1. Restaurar tema (dark/light) guardado
// 2. Verificar si hay sesión guardada (auth.js)
// 3a. Sesión válida → cargar datos (db.js) → mostrar app (ui.js)
// 3b. Sin sesión   → mostrar pantalla de login
// ─────────────────────────────────────────────
async function initApp() {

  // 1. Tema: aplicar antes de mostrar cualquier pantalla
  //    para evitar el "flash" de fondo incorrecto
  if (localStorage.getItem('pos_theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // Actualizar fecha/hora inmediatamente
  if (typeof updateDate === 'function') updateDate();

  // 2. Vincular Enter en el buscador de productos (POS principal)
  var codeInput = document.getElementById('product-code');
  if (codeInput) {
    codeInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') addProductToCart(codeInput.value);
    });
  }

  // 3. Verificar sesión local (definida en auth.js)
  var sessionOk = false;
  try {
    sessionOk = (typeof checkSession === 'function') ? checkSession() : false;
  } catch (e) {
    console.error('[App] Error al verificar sesión:', e);
  }

  if (sessionOk) {
    // ── Con sesión: cargar datos y mostrar la app ───────────────

    // Intentar conectar con Supabase (modo offline-friendly)
    var dataLoaded = false;
    try {
      if (typeof loadInitialData === 'function') {
        dataLoaded = await loadInitialData();
      }
    } catch (e) {
      console.warn('[App] Supabase no disponible, modo offline:', e.message);
    }

    // Si no hay sucursal en Supabase, ofrecer crear una
    if (!currentSucursal) {
      console.warn('[App] Sin sucursal configurada. Abriendo asistente...');
      try {
        // Intentar crear una sucursal por defecto silenciosamente
        await createSucursalFromForm(true);
      } catch (e) {
        console.warn('[App] No se pudo crear sucursal automáticamente:', e);
      }
    }

    // Ejecutar análisis de IA si hay datos
    if (typeof analyzeBusinessData === 'function') {
      try { analyzeBusinessData(); } catch (e) { /* no bloquear la app */ }
    }

    // Mostrar la app
    if (typeof showMain === 'function') showMain();

  } else {
    // ── Sin sesión: mostrar pantalla de login ───────────────────
    if (typeof showLogin === 'function') showLogin();
  }
}

// ─────────────────────────────────────────────
// createSucursalFromForm(useDefault)
// Crea una sucursal en Supabase.
//
// useDefault = true  → usa nombre "Sucursal Principal" sin pedir datos
// useDefault = false → lee el nombre del popup y lo guarda
//
// Se llama:
//   - Automáticamente desde initApp() si no hay sucursal
//   - Manualmente desde el popup-sucursal (botones del HTML)
// ─────────────────────────────────────────────
window.createSucursalFromForm = async function (useDefault) {
  var name    = useDefault
    ? 'Sucursal Principal'
    : ((document.getElementById('sucursal-name') || {}).value || '').trim() || 'Sucursal Principal';
  var address = useDefault
    ? ''
    : ((document.getElementById('sucursal-address') || {}).value || '').trim();

  if (!window.sb || typeof window.sb.from !== 'function') {
    console.error('[App] createSucursalFromForm: window.sb no disponible');
    return;
  }

  try {
    var res = await window.sb.from('sucursales').insert([{ name: name, address: address }]).select();

    if (res.error) {
      console.error('[App] Error creando sucursal:', res.error.message);
      if (!useDefault) alert('Error al crear sucursal: ' + res.error.message);
      return;
    }

    if (res.data && res.data.length > 0) {
      currentSucursal = res.data[0];
      localStorage.setItem('pos_sucursal', JSON.stringify(currentSucursal));
      console.log('[App] Sucursal creada:', currentSucursal.name);

      if (!useDefault) {
        if (typeof closePopups   === 'function') closePopups();
        if (typeof loadInitialData === 'function') await loadInitialData();
        if (typeof renderAll     === 'function') renderAll();
      }
    }
  } catch (e) {
    console.error('[App] Error inesperado al crear sucursal:', e);
  }
};

// ─────────────────────────────────────────────
// setOpeningCash()
// Lee el input de apertura de caja y lo persiste en Supabase.
// Llamado desde el botón del popup-caja.
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
    var err = await dbSetOpeningCash(val); // definida en db.js
    if (err) {
      alert('Error al guardar: ' + (err.message || err));
    } else {
      if (typeof renderStats === 'function') renderStats();
      alert('✅ Apertura de caja: $' + val.toFixed(2));
    }
  } catch (e) {
    console.error('[App] setOpeningCash falló:', e);
    alert('Error inesperado al guardar la apertura.');
  }
};
