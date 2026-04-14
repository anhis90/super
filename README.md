# Super POS - Cambios IA y mejoras locales

Resumen de los cambios que implementé en este repositorio (fecha: 13/04/2026):

- Añadido módulo de "IA" local: `js/ai.js`
  - `analyzeBusinessData()` analiza productos y ventas y genera:
    - Alertas inteligentes de stock (stock <= configurable)
    - Top productos (hoy / semana)
    - Recomendaciones de compra
    - Detección de productos sin movimiento
  - Expone `window.analyzeBusinessData()` y `window.ai.hookSaleRecorded(tx)`.
  - Soporta múltiples orígenes de datos (variables globales, `localStorage`, tablas DOM)

- Persistencia y manejo de productos: `js/products.js`
  - `addLocalProduct()` (antes `addNewProduct`) guarda productos en `localStorage`.
  - Soporta subida de imagen por archivo y guarda como Data URL (offline).
  - Genera imágenes placeholder SVG automáticas cuando no hay foto.
  - `window.debugProducts()` para inspección rápida en consola.

- Gestión de transacciones y anulación: `js/transactions.js`
  - Guarda/lee transacciones en `localStorage` (clave `transactions`).
  - `voidTransaction(id)` marca `cancelled: true`, guarda `cancelledAt` y restaura stock local si la transacción tiene `items`.

- Cambios en la UI (`index.html`)
  - Mini-panel IA en Dashboard y popup `Inteligencia del Negocio` ya integrado.
  - Formulario de nuevo producto aceptando imagen con preview.
  - Inclusión de `js/products.js`, `js/transactions.js`, `js/ai.js` en el orden correcto.
  - Favicon inline SVG añadido para evitar 404 en GitHub Pages.

Notas técnicas y comandos útiles

- Ejecutar servidor local (recomendado para evitar problemas `file://`):
```powershell
cd C:\Users\anabe\Desktop\proyec
python -m http.server 8000
# luego abrir http://localhost:8000 en el navegador
```

- Debug y utilidades en la consola del navegador:
  - `debugProducts()` → lista productos desde `localStorage` y muestra si tienen imagen.
  - `assignPlaceholdersToAll()` → genera placeholders para productos sin imagen.
  - `analyzeBusinessData()` → fuerza el análisis IA y actualiza UI.
  - `window.voidTransaction('TK-12345')` → anula ticket por ID.

Cómo personalizar reglas IA
- Editar valores por defecto en `js/ai.js`:
  - `STOCK_MIN` → stock mínimo
  - `ANALYSIS_DAYS` → ventana de análisis
  - `NO_MOVE_DAYS` → días para considerar sin movimiento
  - O usar en consola `window.aiConfig.setStockMin(10)` etc.

Sobre sincronización remota (Supabase)
- Actualmente todo está en `localStorage` y variables globales para funcionar offline.
- Si quieres sincronizar con Supabase, es recomendable:
  1) Comprobar si el `code` del producto existe antes de insertar (evitar duplicados)
  2) Usar `upsert` o `patch` para evitar errores de `unique constraint`
  Puedo añadir esa integración si me das la estructura exacta de las tablas y el cliente (ya existe `supabase-client.js` en el proyecto).

Commit final y estado del repo
- Todos los cambios relevantes fueron commiteados y pusheados a `origin/main`.

Siguientes pasos sugeridos (elige uno):
- Probar la app en `http://localhost:8000` y ejecutar `debugProducts()`.
- Añadir sincronización con Supabase (upsert) para productos y anulaciones.
- Mejorar UI de historial para mostrar items por transacción y permitir revertir anulaciones.

Si quieres que yo realice alguno de esos pasos, dime cuál y lo implemento.
