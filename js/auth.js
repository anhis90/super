/* 
   js/auth.js
   Sistema de Autenticación Local — Demo / POS
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
    window.checkSession = async function() {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
            try {
                const sessionUser = JSON.parse(sessionData);
                currentUser = sessionUser;
                updateUIForUser(currentUser);
                return true;
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

        const userInput = userInp.value.trim().toLowerCase();
        const password = passInp.value.trim();

        if (errEl) errEl.style.display = 'none';

        if (!userInput || !password) {
            showLoginError('Por favor, ingresa usuario y contraseña.');
            return;
        }

        if (btn) btn.disabled = true;

        // AUTH LOCAL: Validar estrictamente contra los usuarios configurados
        const foundUser = VALID_USERS.find(
            (u) => u.username.toLowerCase() === userInput && u.password === password
        );

        if (!foundUser) {
            showLoginError('❌ Usuario o contraseña incorrectos.');
            if (btn) btn.disabled = false;
            return;
        }

        // Éxito
        currentUser = { 
            username: foundUser.username,
            role: foundUser.role,
            name: foundUser.name,
            id: foundUser.username // Identificador local
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
        updateUIForUser(currentUser);
        
        try {
            if (typeof loadInitialData === 'function') await loadInitialData();
        } catch (e) { 
            console.warn('Carga inicial fallida. Verifique conexión a DB:', e); 
            // Si cargaDatos falla por base de datos, mostramos un error de conexión real
            showLoginError('Fallo de conexión a la base de datos al cargar los datos.');
            if (btn) btn.disabled = false;
            return;
        }

        if (typeof showMain === 'function') showMain();
        if (btn) btn.disabled = false;
    };

    window.handleLogout = async function() {
        localStorage.removeItem(SESSION_KEY);
        currentUser = null;
        if (typeof showLogin === 'function') showLogin();
        window.location.reload();
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
