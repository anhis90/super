/**
 * js/auth.js
 * Lógica de autenticación local.
 */

import { state } from './state.js';
import { VALID_USERS, APP_CONFIG } from './config.js';

export function checkSession() {
  const raw = localStorage.getItem(APP_CONFIG.SESSION_KEY);
  if (!raw) return false;

  try {
    const user = JSON.parse(raw);
    if (user && user.username && user.role) {
      state.currentUser = user;
      return true;
    }
  } catch (e) {
    localStorage.removeItem(APP_CONFIG.SESSION_KEY);
  }
  return false;
}

export function login(username, password) {
  const user = VALID_USERS.find(u => 
    u.username.toLowerCase() === username.toLowerCase() && 
    u.password === password
  );

  if (user) {
    state.currentUser = {
      username: user.username,
      role: user.role,
      name: user.name,
      id: user.username
    };
    localStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(state.currentUser));
    return { success: true };
  }
  
  return { success: false, message: 'Usuario o contraseña incorrectos.' };
}

export function logout() {
  localStorage.removeItem(APP_CONFIG.SESSION_KEY);
  state.currentUser = null;
  window.location.reload();
}
