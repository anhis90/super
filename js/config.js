/**
 * js/config.js
 * Configuración global y constantes.
 */

export const SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_9ujBRAnvDfBmtrPSNY6hBg__tHkQXX6';

export const APP_CONFIG = {
  IVA_DEFAULT: 21,
  SESSION_KEY: 'pos_session_local',
  THEME_KEY: 'pos_theme',
  SUCURSAL_KEY: 'pos_sucursal'
};

export const VALID_USERS = [
  { username: 'admin',  password: '1234', role: 'admin',  name: 'Administrador' },
  { username: 'cajero', password: '1234', role: 'cajero', name: 'Cajero'         }
];
