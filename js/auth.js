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
    window.checkSession = async function() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = { 
                username: session.user.user_metadata?.username || session.user.email.split('@')[0], 
                role: session.user.user_metadata?.role || 'cajero',
                id: session.user.id
            };
            updateUIForUser(currentUser);
            return true;
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
            showLoginError('Por favor, ingresa usuario y contraseña');
            return;
        }

        if (btn) btn.disabled = true;

        // Convertir usuario simple a email si es necesario
        const email = userInput.includes('@') ? userInput : `${userInput}@pos.com`;

        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showLoginError('❌ Credenciales inválidas o error de conexión');
            if (btn) btn.disabled = false;
            return;
        }

        // Éxito
        currentUser = { 
            username: data.user.user_metadata?.username || userInput, 
            role: data.user.user_metadata?.role || 'cajero',
            id: data.user.id
        };

        updateUIForUser(currentUser);
        
        try {
            if (typeof loadInitialData === 'function') await loadInitialData();
        } catch (e) { console.warn('Carga inicial fallida:', e); }

        if (typeof showMain === 'function') showMain();
        if (btn) btn.disabled = false;
    };

    window.handleLogout = async function() {
        await sb.auth.signOut();
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
