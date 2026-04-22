/**
 * js/supabase.js
 * Inicialización única del cliente Supabase.
 */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Cargamos el SDK desde el CDN como módulo ESM
// Esto evita conflictos con variables globales 'supabase'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

console.log('[Supabase] Cliente inicializado correctamente.');

export default supabase;
