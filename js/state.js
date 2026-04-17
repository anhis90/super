// ============================================================
// js/state.js
// Estado Global de la Aplicación — declarado PRIMERO
//
// ¿Por qué existe este archivo separado?
//
// Los módulos (auth.js, db.js, ui.js, cart.js, ai.js) necesitan
// leer y escribir estas variables compartidas. Si cualquiera
// de esos archivos cargara ANTES de que las variables estén
// declaradas, obtendríamos ReferenceError en modo estricto.
//
// Solución: state.js carga primero (posición 1 en el <head> con defer)
// y declara todo el estado con `var`. Así todos los módulos
// que cargan después encuentran las variables ya existentes.
//
// ¿Por qué `var` y no `let/const`?
//   - `var` declara en scope global (window.x)
//   - `let` y `const` en scope de bloque → no accesibles desde
//     otros scripts sin import/export
//   - Como usamos scripts clásicos (no ES modules), `var` es
//     la única forma de compartir estado entre archivos
//
// ¿Por qué no window.x = ... directamente?
//   - Con `var` en scope global, ES lo mismo que window.x
//   - Pero `var` es hoisted y más compatible cross-browser
// ============================================================

// ─────────────────────────────────────────────
// USUARIO Y SUCURSAL
// ─────────────────────────────────────────────
var currentUser     = null;   // { username, role, name, id } — se llena en auth.js
var currentSucursal = null;   // { id, name, ... } — se llena en db.js

// ─────────────────────────────────────────────
// DATOS DEL NEGOCIO
// ─────────────────────────────────────────────
var products     = [];   // Catálogo de productos de la sucursal
var suppliers    = [];   // Proveedores
var purchases    = [];   // Historial de compras / ingresos de stock
var promos       = [];   // Promociones tipo "Llevá X, Pagá Y"
var transactions = [];   // Historial de ventas
var paymentRules = [];   // Métodos de pago con sus descuentos
var cart         = [];   // Ítems en el carrito de venta actual

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────
var ivaConfig   = 21;   // Porcentaje de IVA (default 21%, se sobreescribe desde Supabase)
var openingCash = 0;    // Monto de apertura de caja (se sobreescribe desde Supabase)
