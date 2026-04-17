/* ============================================================
   js/auth.js
   Sistema de Autenticación Local Exclusivo

   ✅ Por qué NO usamos Supabase Auth:
   - Supabase Auth requiere confirmación de email por defecto.
   - Para un POS local, el flujo simple admin/cajero es suficiente.
   - Evitamos dependencia de internet para el LOGIN (la app puede
     funcionar offline si los datos ya están cargados).

   Flujo:
   1. Usuario ingresa username + password
   2. Se valida contra VALID_USERS (hardcoded)
   3. Se guarda la sesión en localStorage (pos_session_local)
   4. loadInitialData() carga datos desde Supabase (si hay conexión)
   ============================================================ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // USUARIOS CONFIGURADOS
  // Para agregar usuarios: duplicar la línea y cambiar los datos.
  // Para escalabilidad futura: mover esto a Supabase tabla "usuarios_pos"
  // ─────────────────────────────────────────────
  var VALID_USERS = [
    { username: 'admin',  password: '1234', role: 'admin',  name: 'Administrador' },
    { username: 'cajero', password: '1234', role: 'cajero', name: 'Cajero'         }
  ];

  var SESSION_KEY = 'pos_session_local';

  // ─────────────────────────────────────────────
  // checkSession()
  // Verifica si hay una sesión guardada en localStorage.
  // Llamado al iniciar la app (app.js → initApp).
  // ─────────────────────────────────────────────
  window.checkSession = function () {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;

    try {
      var user = JSON.parse(raw);
      // Validar que la sesión tenga los campos mínimos requeridos
      if (user && user.username && user.role) {
        currentUser = user;
        _updateUIForUser(user);
        return true;
      }
    } catch (e) {
      console.warn('[Auth] Sesión corrupta en localStorage, limpiando...', e);
      localStorage.removeItem(SESSION_KEY);
    }

    return false;
  };

  // ─────────────────────────────────────────────
  // handleLogin()
  // Valida credenciales y establece la sesión local.
  // Se llama desde el formulario de login (onsubmit en index.html).
  // ─────────────────────────────────────────────
  window.handleLogin = async function () {
    var userInp  = document.getElementById('login-user');
    var passInp  = document.getElementById('login-pass');
    var btn      = document.getElementById('btn-login');
    var spinner  = document.getElementById('loading-spinner');

    // Normalizar: todo minúsculas, sin espacios
    var username = (userInp ? userInp.value.trim().toLowerCase() : '');
    var password = (passInp ? passInp.value.trim() : '');

    // Limpiar error anterior
    _showLoginError('');

    // Validación básica
    if (!username || !password) {
      _showLoginError('Por favor, ingresá usuario y contraseña.');
      return;
    }

    // Deshabilitar botón para evitar doble click
    if (btn)     btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    // ── VALIDACIÓN LOCAL ──────────────────────────────────────
    // Buscamos el usuario en la lista hardcoded.
    // En el futuro: reemplazar esto por una consulta a Supabase
    //   con hash de contraseña (bcrypt/argon2) para más seguridad.
    var found = null;
    for (var i = 0; i < VALID_USERS.length; i++) {
      if (VALID_USERS[i].username === username && VALID_USERS[i].password === password) {
        found = VALID_USERS[i];
        break;
      }
    }

    if (!found) {
      _showLoginError('❌ Usuario o contraseña incorrectos.');
      if (btn)     btn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      return;
    }

    // ── LOGIN EXITOSO ─────────────────────────────────────────
    currentUser = {
      username: found.username,
      role:     found.role,
      name:     found.name,
      id:       found.username  // ID local (no es UUID de Supabase)
    };

    // Persistir sesión en localStorage para recargas de página
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    _updateUIForUser(currentUser);

    // Intentar cargar datos desde Supabase (no bloquea si falla)
    try {
      if (typeof loadInitialData === 'function') {
        await loadInitialData();
      }
    } catch (e) {
      console.warn('[Auth] Carga inicial desde Supabase falló (modo offline):', e);
    }

    // Mostrar la app
    if (typeof showMain === 'function') showMain();

    if (btn)     btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  };

  // ─────────────────────────────────────────────
  // handleLogout()
  // Limpia la sesión y vuelve al login.
  // ─────────────────────────────────────────────
  window.handleLogout = function () {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    // Recarga completa para limpiar todo el estado en memoria
    window.location.reload();
  };

  // ─────────────────────────────────────────────
  // FUNCIONES PRIVADAS (solo dentro del módulo)
  // ─────────────────────────────────────────────

  function _showLoginError(msg) {
    var errEl = document.getElementById('login-error');
    if (!errEl) return;
    if (!msg) {
      errEl.style.display = 'none';
      errEl.textContent   = '';
    } else {
      errEl.textContent   = msg;
      errEl.style.display = 'block';
    }
  }

  function _updateUIForUser(user) {
    // Actualizar badge de rol en el header
    var badge = document.getElementById('user-role-badge');
    if (badge) badge.textContent = user.role === 'admin' ? 'Admin' : 'Cajero';

    // Mostrar/ocultar elementos según el rol
    document.querySelectorAll('.admin-only').forEach(function (el) {
      el.style.display = (user.role === 'admin') ? '' : 'none';
    });
  }

  // ─────────────────────────────────────────────
  // Activar/desactivar el botón de login según los campos
  // ─────────────────────────────────────────────
  function _updateBtnState() {
    var u   = document.getElementById('login-user');
    var p   = document.getElementById('login-pass');
    var btn = document.getElementById('btn-login');
    if (btn) {
      btn.disabled = !(u && u.value.trim() && p && p.value.trim());
    }
  }

  // Toggle visibilidad de contraseña
  function _setupPasswordToggle() {
    var toggle  = document.getElementById('pwd-toggle');
    var passInp = document.getElementById('login-pass');
    if (!toggle || !passInp) return;
    toggle.addEventListener('click', function () {
      var isPass = passInp.type === 'password';
      passInp.type    = isPass ? 'text' : 'password';
      toggle.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // Inicializar los listeners cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', function () {
    var userInp = document.getElementById('login-user');
    var passInp = document.getElementById('login-pass');

    if (userInp) {
      userInp.addEventListener('input',  _updateBtnState);
      userInp.addEventListener('change', _updateBtnState); // para autocompletado
    }
    if (passInp) {
      passInp.addEventListener('input',  _updateBtnState);
      passInp.addEventListener('change', _updateBtnState);
    }

    // Detectar autocompletado del browser (que no dispara 'input')
    setTimeout(_updateBtnState, 300);
    setTimeout(_updateBtnState, 800); // segundo intento para autocompletado lento

    _setupPasswordToggle();
  });

})();
