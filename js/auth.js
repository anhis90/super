/* js/auth.js
   Nuevo módulo de autenticación local para SuperPOSPro
   - Maneja UI del login (habilitar botón, mostrar errores, loading)
   - Valida credenciales locales demo: admin/1234 y cajero/1234
   - Persiste sesión en localStorage (clave: 'sessionUser') solo si login válido
   - Evita dobles envíos y deshabilita botón mientras valida
*/

(function(){
  'use strict';

  const VALID_USERS = { admin: '1234', cajero: '1234' };
  const KEY_SESSION = 'sessionUser';
  let isAuthenticating = false;

  function $(id){ return document.getElementById(id); }

  function showError(msg){
    const el = $('login-error'); if(!el) return;
    el.innerText = msg; el.style.display = 'block';
  }
  function clearError(){ const el = $('login-error'); if(!el) return; el.innerText=''; el.style.display='none'; }

  function setLoading(on){
    const btn = $('btn-login'); const spinner = $('loading-spinner');
    if(on){ isAuthenticating = true; btn.setAttribute('disabled',''); spinner.style.display='inline-block'; }
    else { isAuthenticating = false; btn.removeAttribute('disabled'); spinner.style.display='none'; }
  }

  function finishLogin(username){
    try{ localStorage.setItem(KEY_SESSION, username); }catch(e){}
    // mostrar app principal
    const main = $('main-app') || $('main-app') || document.getElementById('main-app');
    if(main) main.style.display = 'block';
    const loginScreen = $('login-screen'); if(loginScreen) loginScreen.style.display = 'none';
    // badge
    const badge = $('user-role-badge'); if(badge) badge.innerText = (username === 'admin') ? 'Admin' : 'Cajero';
  }

  // Lógica principal de login
  async function handleLogin(ev){
    if(isAuthenticating) return;
    clearError();
    const user = ($('login-user')?.value || '').trim();
    const pass = ($('login-pass')?.value || '').trim();
    if(!user){ showError('El usuario no puede estar vacío'); $('login-user')?.focus(); return; }
    if(!pass){ showError('La contraseña no puede estar vacía'); $('login-pass')?.focus(); return; }
    setLoading(true);
    try{
      // Simular llamada asíncrona mínima para UX
      await new Promise(r => setTimeout(r, 300));
      const valid = Object.prototype.hasOwnProperty.call(VALID_USERS, user) && VALID_USERS[user] === pass;
      if(!valid){ showError('Usuario o contraseña incorrectos'); setLoading(false); return; }
      // Login exitoso
      finishLogin(user);
    }catch(e){ console.error('Auth error', e); showError('Error al validar credenciales'); }
    setLoading(false);
  }

  function handleLogout(){
    try{ localStorage.removeItem(KEY_SESSION); }catch(e){}
    // mostrar login
    const main = document.getElementById('main-app'); if(main) main.style.display = 'none';
    const loginScreen = document.getElementById('login-screen'); if(loginScreen) loginScreen.style.display = 'flex';
    // limpiar campos
    $('login-pass') && ($('login-pass').value = '');
    clearError();
    setTimeout(()=>{ $('login-user') && $('login-user').focus(); }, 60);
  }

  function togglePassword(){
    const inp = $('login-pass'); if(!inp) return; inp.type = (inp.type === 'password') ? 'text' : 'password';
    const btn = $('pwd-toggle'); if(btn) btn.innerText = (inp.type === 'password') ? '👁️' : '🙈';
  }

  function updateBtnState(){
    const btn = $('btn-login'); if(!btn) return;
    const user = ($('login-user')?.value || '').trim(); const pass = ($('login-pass')?.value || '').trim();
    if(user && pass && !isAuthenticating) btn.removeAttribute('disabled'); else btn.setAttribute('disabled','');
  }

  function initAuth(){
    document.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const active = document.activeElement; if(active && (active.id==='login-user' || active.id==='login-pass')){ handleLogin(); } } });
    $('btn-login')?.addEventListener('click', handleLogin);
    $('pwd-toggle')?.addEventListener('click', togglePassword);
    ['login-user','login-pass'].forEach(id=>{ const el = $(id); if(el) el.addEventListener('input', updateBtnState); });
    // focus inicial
    setTimeout(()=>{ $('login-user') && $('login-user').focus(); updateBtnState(); }, 80);

    // Auto-login mínimo si session válida en localStorage
    const sess = localStorage.getItem(KEY_SESSION);
    if(sess && Object.prototype.hasOwnProperty.call(VALID_USERS, sess)){
      // No hacemos bypass: si existe sesión almacenada y usuario aún válido, restaurar
      finishLogin(sess);
    }
    // Exponer funciones globales (compatibilidad con botones inline)
    window.handleLogin = handleLogin; window.handleLogout = handleLogout; window.auth = { isAuthenticated: ()=> !!localStorage.getItem(KEY_SESSION) };
  }

  document.addEventListener('DOMContentLoaded', initAuth);

})();
// ============================================================
// js/auth.js
// Sistema de login LOCAL — sin Supabase Auth, sin email
// La sesión se guarda en localStorage para persistir al recargar
// ============================================================

// Usuarios definidos localmente (sin base de datos de usuarios)
// Para agregar más usuarios, simplemente añadir al array
const LOCAL_USERS = [
  { username: 'admin',  password: '1234', role: 'admin'  },
  { username: 'cajero', password: '1234', role: 'cajero' },
];

/**
 * checkSession()
 * Verifica si hay una sesión guardada en localStorage.
 * Si existe, restaura el usuario y muestra la app.
 * Si no, muestra la pantalla de login.
 */
function checkSession() {
  const stored = localStorage.getItem('pos_session');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return true; // hay sesión activa
    } catch (e) {
      localStorage.removeItem('pos_session');
    }
  }
  return false; // no hay sesión
}

/**
 * handleLogin()
 * Valida usuario y contraseña contra la lista LOCAL_USERS.
 * Si es correcto, guarda la sesión en localStorage y abre la app.
 * No hace ninguna llamada a internet.
 */
async function handleLogin() {
  const username = document.getElementById('login-user').value.trim().toLowerCase();
  const password = document.getElementById('login-pass').value.trim();

  // Buscar usuario en la lista local
  const found = LOCAL_USERS.find(u => u.username === username && u.password === password);

  if (!found) {
    // Mostrar error visual en lugar de alert
    const errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.textContent = '❌ Usuario o contraseña incorrectos';
      errEl.style.display = 'block';
      setTimeout(() => errEl.style.display = 'none', 3000);
    } else {
      alert('Usuario o contraseña incorrectos');
    }
    return;
  }

  // Crear objeto de sesión y guardarlo en localStorage
  currentUser = { username: found.username, role: found.role };
  localStorage.setItem('pos_session', JSON.stringify(currentUser));

  // Cargar datos y mostrar la app
  await loadInitialData();
  showMain();
}

/**
 * handleLogout()
 * Cierra la sesión eliminando el localStorage y vuelve al login.
 */
function handleLogout() {
  currentUser = null;
  localStorage.removeItem('pos_session');
  showLogin();
}
