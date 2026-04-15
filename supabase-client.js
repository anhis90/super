// ============================================================
// supabase-client.js
// Inicializa el cliente de Supabase y lo expone como window.sb
// NO se usa Supabase Auth — solo operaciones CRUD de base de datos
// ============================================================

const SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';

// Clave pública (publishable key) — segura para el frontend con RLS activo
const SUPABASE_KEY = 'sb_publishable_9ujBRAnvDfBmtrPSNY6hBg__tHkQXX6';

// Usamos window.sb para evitar conflictos con la variable global "supabase"
// que es inyectada automáticamente por el CDN de Supabase
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});