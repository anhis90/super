// 🔗 Configuración Supabase
const SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';

// ⚠️ REEMPLAZÁ esta key por la nueva que empieza con "sb_publishable_..."
const SUPABASE_KEY = 'sb_publishable_TU_KEY_AQUI';

// Crear cliente
const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);