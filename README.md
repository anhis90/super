# Super POS Pro - Sistema Modular de Punto de Venta

Sistema de punto de venta profesional refactorizado con arquitectura modular ESM y sincronización con Supabase.

## Arquitectura Modular

El proyecto ha sido completamente rediseñado para mayor estabilidad y compatibilidad (especialmente con Firefox):

- **`js/app.js`**: Orquestador principal y punto de entrada.
- **`js/api.js`**: Capa de Acceso a Datos (DAL) que centraliza la comunicación con Supabase.
- **`js/supabase.js`**: Inicialización segura del cliente Supabase desde CDN (ESM).
- **`js/state.js`**: Gestión de estado global centralizada.
- **`js/auth.js`**: Sistema de autenticación local (admin/cajero).
- **`js/ui.js`**: Lógica de renderizado y manipulación del DOM.
- **`js/cart.js`**: Lógica de carrito, búsqueda y procesamiento de ventas.
- **`js/ai.js`**: Módulo de Inteligencia de Negocio para alertas de stock y análisis de ventas.
- **`js/config.js`**: Configuración global, constantes y usuarios válidos.

## Características Principales

- **Arquitectura ESM**: Uso de módulos de JavaScript nativos para evitar conflictos de variables globales.
- **Sincronización con Supabase**: Persistencia en tiempo real de productos, ventas, proveedores y configuraciones.
- **Inteligencia de Negocio (IA)**: Análisis automático de tendencias de ventas y alertas preventivas.
- **Sistema de Promociones**: Soporte para reglas "Llevá X, Pagá Y" y descuentos por medio de pago.
- **Gestión de Caja**: Control de apertura, ingresos y egresos manuales.
- **Modo Oscuro**: Interfaz moderna con soporte para temas dinámicos.

## Instalación y Uso Local

Para ejecutar el proyecto localmente y evitar problemas de CORS o restricciones del protocolo `file://`, se recomienda usar un servidor web simple:

1. Clonar el repositorio.
2. Abrir una terminal en el directorio del proyecto.
3. Ejecutar un servidor (ejemplo con `npx`):
   ```bash
   npx http-server -p 8080
   ```
4. Acceder a `http://localhost:8080`.

### Credenciales de Demo
- **Administrador**: `admin` / `1234`
- **Cajero**: `cajero` / `1234`

## Siguientes Pasos
- [ ] Implementar reportes gráficos avanzados (Charts.js).
- [ ] Agregar soporte para múltiples sucursales con selector inicial.
- [ ] Integrar facturación electrónica oficial.

---
*Mantenido por Antigravity AI*
