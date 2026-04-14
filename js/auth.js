/* 
   js/auth.js
   Sistema de Autenticación Local — Seguridad Reforzada
*/

(function() {
    'use strict';

    const VALID_USERS = [
        { username: 'admin',  password: '1234', role: 'admin',  name: 'Administrador' },
        { username: 'cajero', password: '1234', role: 'cajero', name: 'Cajero' }
    ];

    const SESSION_KEY = 'pos_session';

    /**
     * checkSession() 
     */
    window.checkSession = function() {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
            try {
                const sessionData = JSON.parse(stored);
                // Validar que la sesión sea legítima (que el usuario exista)
                const exists = VALID_USERS.some(u => u.username === sessionData.username);
                if (exists) {
                    currentUser = sessionData;
                    updateUIForUser(currentUser);
                    return true;
                }
            } catch (e) {
                localStorage.removeItem(SESSION_KEY);
            }
        }
        return false;
    };

    /**
     * handleLogin()
     */
    window.handleLogin = async function() {
        const userInp = document.getElementById('login-user');
        const passInp = document.getElementById('login-pass');
        const errEl   = document.getElementById('login-error');
        const btn     = document.getElementById('btn-login');

        const username = userInp.value.trim().toLowerCase();
        const password = passInp.value.trim();

        if (errEl) errEl.style.display = 'none';

        // REQUISITO ESTRICTO: Usuario y Contraseña obligatorios
        if (!username || !password) {
            showLoginError('Por favor, ingresa usuario y contraseña');
            return;
        }

        // Deshabilitar botón para evitar doble envío
        if (btn) btn.disabled = true;

        // Validar credenciales
        const user = VALID_USERS.find(u => u.username === username && u.password === password);

        if (!user) {
            showLoginError('❌ Usuario o contraseña incorrectos');
            if (btn) btn.disabled = false;
            return;
        }

        // Éxito
        currentUser = { username: user.username, role: user.role, name: user.name };
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));

        updateUIForUser(currentUser);
        
        try {
            if (typeof loadInitialData === 'function') await loadInitialData();
        } catch (e) { console.warn(e); }

        if (typeof showMain === 'function') showMain();
        if (btn) btn.disabled = false;
    };

    function showLoginError(msg) {
        const errEl = document.getElementById('login-error');
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        } else {
            alert(msg);
        }
    }

    /**
     * handleLogout()
     */
    window.handleLogout = function() {
        currentUser = null;
        localStorage.removeItem(SESSION_KEY);
        // Limpiar campos del login
        const u = document.getElementById('login-user');
        const p = document.getElementById('login-pass');
        if (u) u.value = '';
        if (p) p.value = '';
        
        if (typeof showLogin === 'function') showLogin();
        // Recargar para limpiar estado de memoria
        window.location.reload();
    };

    function updateUIForUser(user) {
        const badge = document.getElementById('user-role-badge');
        if (badge) {
            badge.innerText = user.role === 'admin' ? 'Admin' : 'Cajero';
        }
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = (user.role === 'admin') ? '' : 'none';
        });
    }

    /**
     * updateBtnState()
     * Activa el botón solo si hay texto en ambos campos
     */
    function updateBtnState() {
        const u = document.getElementById('login-user')?.value.trim();
        const p = document.getElementById('login-pass')?.value.trim();
        const btn = document.getElementById('btn-login');
        if (btn) btn.disabled = !(u && p);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const loginBtn = document.getElementById('btn-login');
        const userInp = document.getElementById('login-user');
        const passInp = document.getElementById('login-pass');

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.handleLogin();
            });
        }
        
        // Escuchar tanto input como change (para autocompletado)
        [userInp, passInp].forEach(el => {
            if (el) {
                el.addEventListener('input', updateBtnState);
                el.addEventListener('change', updateBtnState);
            }
        });

        if (passInp) {
            passInp.onkeypress = (e) => {
                if (e.key === 'Enter') window.handleLogin();
            };
        }
        
        // Verificación inicial para capturar autocompletado al cargar
        setTimeout(updateBtnState, 500); 
    });

})();
