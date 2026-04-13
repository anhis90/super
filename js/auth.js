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
