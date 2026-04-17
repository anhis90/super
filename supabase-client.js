// ============================================================
// supabase-client.js
// Inicializa el cliente Supabase y lo expone como window.sb
//
// ❌ PROBLEMA FIREFOX: Declarar `const SUPABASE_URL` en scope global
//    provoca "redeclaration of non-configurable global property"
//    si otro script (o una extensión) ya declaró esa variable.
//    Firefox respeta el estándar ES2015 más estrictamente que Chrome.
//
// ✅ SOLUCIÓN: Envolver todo en un IIFE para que las constantes
//    queden en scope local (no global), eliminando el conflicto.
// ============================================================

(function () {
  'use strict';

  // Credenciales de Supabase — en un IIFE seguro (no globales)
  var SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';

  // Clave pública (publishable key) — segura para el frontend con RLS activo
  var SUPABASE_KEY = 'sb_publishable_9ujBRAnvDfBmtrPSNY6hBg__tHkQXX6';

  // ─────────────────────────────────────────────────────────────
  // ¿Por qué usamos window.sb y no window.supabase?
  //
  // El CDN de Supabase v2 expone el SDK como window.supabase
  // (el objeto con createClient, etc.).
  // Si reasignamos window.supabase = createClient(...), DESTRUIMOS
  // el SDK original → supabase.auth pasa a ser undefined.
  //
  // Solución correcta: guardar el cliente en window.sb (nombre propio)
  // y acceder al SDK original por `window.supabase.createClient`.
  // ─────────────────────────────────────────────────────────────

  // Compatibilidad cross-browser: el CDN puede exponer el SDK
  // en window.supabase o en window.supabase.supabase (bundle UMD)
  var sdkLib = (window.supabase && window.supabase.createClient)
    ? window.supabase
    : (window.supabase && window.supabase.supabase ? window.supabase.supabase : null);

  if (!sdkLib || typeof sdkLib.createClient !== 'function') {
    console.error(
      '[SuperPOS] Error crítico: El SDK de Supabase no se cargó correctamente. ' +
      'Verifica que el script CDN esté antes de supabase-client.js en el HTML.'
    );
    // Exponemos un objeto stub para que la app no rompa totalmente
    window.sb = {
      from: function () { return { select: function () { return Promise.resolve({ data: [], error: { message: 'Supabase no disponible' } }); } }; },
      auth: { signIn: function () { return Promise.resolve({ error: 'SDK no disponible' }); } }
    };
    return;
  }

  // Crear el cliente con Auth desactivado (usamos login local)
  window.sb = sdkLib.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,       // No guardar sesión de Supabase Auth (usamos sesión local)
      autoRefreshToken: false,     // No renovar tokens automáticamente
      detectSessionInUrl: false    // No leer tokens de la URL (evita errores en Firefox)
    }
  });

  console.log('[SuperPOS] Supabase inicializado correctamente como window.sb ✅');

})();