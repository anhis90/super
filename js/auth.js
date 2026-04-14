/* 
   js/auth.js
   Sistema de Autenticación Local para SuperPOS Pro
   
   PRINCIPIOS:
   - NO usa Supabase Auth (solo Base de Datos).
   - Basado en credenciales locales predefinidas.
   - Persistencia de sesión en localStorage.
   - Seguridad simple basada en roles (Admin/Cajero).
*/

(function() {
    'use strict';

    // Usuarios autorizados (puedes añadir más aquí)
    const VALID_USERS = [
        { username: 'admin',  password: '1234', role: 'admin',  name: 'Administrador' },
        { username: 'cajero', password: '1234', role: 'cajero', name: 'Cajero' }
    ];

    const SESSION_KEY = 'pos_session';

    /**
     * checkSession() 
     * Verifica si existe una sesión activa al cargar la página.
     */
    window.checkSession = function() {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
            try {
                window.currentUser = JSON.parse(stored);
                updateUIForUser(window.currentUser);
                return true;
            } catch (e) {
                localStorage.removeItem(SESSION_KEY);
            }
        }
        return false;
    };

    /**
     * handleLogin()
     * Procesa el formulario de entrada.
     */
    window.handleLogin = async function() {
        const userInp = document.getElementById('login-user');
        const passInp = document.getElementById('login-pass');
        const errEl   = document.getElementById('login-error');

        const username = userInp.value.trim().toLowerCase();
        const password = passInp.value.trim();

        // Limpiar errores previos
        if (errEl) errEl.style.display = 'none';

        // Validar contra la lista local
        const user = VALID_USERS.find(u => u.username === username && u.password === password);

        if (!user) {
            if (errEl) {
                errEl.textContent = '❌ Usuario o contraseña incorrectos';
                errEl.style.display = 'block';
            } else {
                alert('Usuario o contraseña incorrectos');
            }
            return;
        }

        // Éxito: Guardar sesión
        window.currentUser = { username: user.username, role: user.role, name: user.name };
        localStorage.setItem(SESSION_KEY, JSON.stringify(window.currentUser));

        // Actualizar UI y Cargar Datos
        updateUIForUser(window.currentUser);
        
        try {
            if (typeof loadInitialData === 'function') await loadInitialData();
        } catch (e) {
            console.warn("Error cargando datos iniciales tras login:", e);
        }

        if (typeof showMain === 'function') showMain();
    };

    /**
     * handleLogout()
     * Limpia la sesión y vuelve al login.
     */
    window.handleLogout = function() {
        window.currentUser = null;
        localStorage.removeItem(SESSION_KEY);
        if (typeof showLogin === 'function') showLogin();
    };

    /**
     * updateUIForUser()
     * Ajusta elementos visuales según el rol del usuario.
     */
    function updateUIForUser(user) {
        const badge = document.getElementById('user-role-badge');
        if (badge) {
            badge.innerText = user.role === 'admin' ? 'Admin' : 'Cajero';
            badge.className = 'user-badge ' + (user.role === 'admin' ? 'badge-admin' : 'badge-staff');
        }

        // Ocultar/Mostrar elementos restringidos para administradores
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = (user.role === 'admin') ? '' : 'none';
        });
    }

    // Configurar escuchas de eventos una vez cargado el DOM
    document.addEventListener('DOMContentLoaded', () => {
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.onclick = window.handleLogin;
        }

        // Permitir login con la tecla Enter
        const passInp = document.getElementById('login-pass');
        if (passInp) {
            passInp.onkeypress = (e) => {
                if (e.key === 'Enter') window.handleLogin();
            };
        }
    });

})();
