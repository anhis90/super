/* 
   js/auth.js
   Sistema de Autenticación Remoto — Supabase Auth
*/

(function() {
    'use strict';

    /**
     * checkSession() 
     */
    window.checkSession = async function() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentUser = { 
                email: session.user.email,
                username: session.user.user_metadata?.username || session.user.email.split('@')[0], 
                role: session.user.user_metadata?.role || 'admin',
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
        const emailInp = document.getElementById('login-email');
        const passInp  = document.getElementById('login-pass');
        const errEl    = document.getElementById('login-error');
        const btn      = document.getElementById('btn-login');

        const email    = emailInp.value.trim().toLowerCase();
        const password = passInp.value.trim();

        if (errEl) errEl.style.display = 'none';

        if (!email || !password) {
            showLoginError('Por favor, ingresa tu email y contraseña.');
            return;
        }

        if (btn) btn.disabled = true;
        
        // Carga visual
        const prevText = btn.textContent;
        btn.textContent = "Verificando...";

        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            btn.disabled = false;
            btn.textContent = prevText;
            
            // Si el error es específicamente de credenciales:
            if (error.message.includes('Invalid login credentials')) {
                showLoginError('❌ Email o contraseña incorrectos.');
            } else {
                showLoginError('❌ Error de conexión: ' + error.message);
            }
            return;
        }

        // Éxito
        currentUser = { 
            email: data.user.email,
            username: data.user.user_metadata?.username || email.split('@')[0], 
            role: data.user.user_metadata?.role || 'admin',
            id: data.user.id
        };

        updateUIForUser(currentUser);
        
        try {
            if (typeof loadInitialData === 'function') await loadInitialData();
        } catch (e) { 
            console.warn('Carga inicial fallida. Verifique conexión a DB:', e); 
            showLoginError('Fallo de conexión a la base de datos al cargar los datos.');
            btn.disabled = false;
            btn.textContent = prevText;
            return;
        }

        if (typeof showMain === 'function') showMain();
        btn.disabled = false;
        btn.textContent = prevText;
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
        const u = document.getElementById('login-email')?.value.trim();
        const p = document.getElementById('login-pass')?.value.trim();
        const btn = document.getElementById('btn-login');
        if (btn) btn.disabled = !(u && p);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const loginBtn = document.getElementById('btn-login');
        const emailInp = document.getElementById('login-email');
        const passInp  = document.getElementById('login-pass');

        if (loginBtn) {
            // Se maneja usando submit en el form
        }
        
        // Escuchar tanto input como change (para autocompletado)
        [emailInp, passInp].forEach(el => {
            if (el) {
                el.addEventListener('input', updateBtnState);
                el.addEventListener('change', updateBtnState);
            }
        });

        // Verificación inicial para capturar autocompletado al cargar
        setTimeout(updateBtnState, 500); 
    });

})();
