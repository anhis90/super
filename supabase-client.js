// 🔗 Configuración de Supabase
const SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9ujBRAnvDfBmtrPSNY6hBg__tHkQXX6';

// Asignamos el cliente inicializado directamente al objeto window
// Esto evita el error "redeclaration of non-configurable global property supabase" 
// al no usar const/let que colisionen con el script del CDN, pero permite usarlo globalmente.
window.supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);