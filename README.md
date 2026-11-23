# EntradasYa · web

Interfaz React con TypeScript para cliente, organizador y portero. Proyecto independiente, sin base de datos ni dependencias de archivos de otros repositorios. Incluye las nueve fotografías de demostración y sus créditos en `public/`.

## Requisitos e instalación

Node.js 24.20.0 (ver `.nvmrc`), npm y Nginx. En Windows usa Ubuntu en WSL2 (`wsl --install -d Ubuntu` desde PowerShell como administrador) y clona dentro de `~/proyectos/`. Instala Node.js 24 con tu gestor de versiones. En Ubuntu instala Nginx con `sudo apt-get update && sudo apt-get install -y nginx`.

Desde la raíz del repositorio:

```bash
npm ci
cp .env.example .env
npm run typecheck
npm test
npm run build
npm run check:nginx
npm start
```

Abre http://localhost:8080. El proceso Nginx se mantiene en primer plano; **Ctrl+C** lo detiene. Cambia WEB_PORT en `.env` si el puerto está ocupado. Usa el mismo origen en WEB_BASE_URL de notifications y DEMO_IMAGES_BASE_URL de events. El launcher no elige otro puerto automáticamente.

## API y Nginx

La web consume `/api` del mismo origen. Su configuración Nginx está en `nginx/start.ts` y genera el archivo operativo en `.local/nginx/nginx.conf`. Las peticiones públicas se reenvían a auth, events, orders, tickets y checkin en loopback. Configura sus puertos mediante AUTH_PORT, EVENTS_PORT, ORDERS_PORT, TICKETS_PORT y CHECKIN_PORT. Las rutas internas, payments y notifications no se exponen.

`NGINX_BIN` permite indicar la ruta al binario; `WEB_DIST` permite usar otra compilación estática. `npm run build` genera `dist/`. `GET /health` comprueba que la compilación está disponible, sin requerir que los backends estén activos.

Nginx es infraestructura de apoyo; este repositorio conserva la configuración de entrada para los ocho componentes. PostgreSQL y Mailpit se instalan manualmente según los README de cada backend.

## Demostración completa

Prepara las bases y migraciones en los seis backends con persistencia. Arranca Mailpit. Abre una terminal por componente y sigue este orden: auth y events; payments, tickets y notifications; orders y checkin; finalmente web. Todos usan `npm start` desde su propio repositorio; se detienen con Ctrl+C.

En auth ejecuta `npm run seed`. Las cuentas son `organizador@example.test` y `portero@example.test`, ambas con contraseña `demo-entradasya`. Registra el cliente desde la web. Sigue el README de events para cargar los nueve eventos y vincularlos al organizador. La bandeja Mailpit está en http://localhost:8025. Las compras son simuladas.

Verifica registro, compra, PDF con QR, correo, ingreso y rechazo del segundo escaneo. Comprueba también pago rechazado, cupo agotado y compra válida con notifications detenido. El escaneo manual permite probar sin cámara.

## Independencia y futuro CI/CD

Los tipos de API consumidos están en `src/contracts.ts`; no hay imports de otros repositorios. La metadata editorial es propia de web. Coordina cambios compatibles en las API y actualiza los tipos consumidores. El pipeline futuro puede ejecutar `npm ci`, `npm run typecheck`, `npm test` y `npm run build` sin clonar backends. La integración completa necesita los servicios activos y sus datos de prueba. No se agregaron pipelines ni herramientas fuera del alcance.

Conserva imágenes subidas, PDF y bases en los backends propietarios; no pertenecen a `dist/`. Nunca publiques `.env` ni `.local/`.

## Bitácora

| Fecha | Incidencia | Resolución |
| --- | --- | --- |
| 2026-11-23 | Build y tipos dependían de la raíz. | Build, Nginx, tipos y recursos incorporados en web. |

## Ramas de trabajo

- `development`: rama activa para implementar y verificar cambios.
- `main`: rama reservada para versiones aprobadas para producción.

Antes de trabajar, ejecuta `git switch development`. Cuando una versión esté validada, intégrala desde `development` hacia `main` mediante un pull request. Después vuelve a `development`. No trabajes directamente sobre `main`.

Los futuros pipelines verificarán los cambios en `development` y desplegarán a producción desde `main`. Crear o actualizar una rama local no despliega la aplicación; los pipelines todavía no están implementados. Al publicar en GitHub, configura `development` como rama predeterminada y protege `main` para exigir revisión y verificaciones antes de integrar cambios.
