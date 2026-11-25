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

Los tipos de API consumidos están en `src/contracts.ts`; no hay imports de otros repositorios. La metadata editorial es propia de web. Coordina cambios compatibles en las API y actualiza los tipos consumidores. El pipeline puede ejecutar `npm ci`, `npm run typecheck`, `npm test` y `npm run build` sin clonar backends. La integración completa necesita los servicios activos y sus datos de prueba. El pipeline genera artefactos sin agregar despliegues ni herramientas fuera del alcance.

Conserva imágenes subidas, PDF y bases en los backends propietarios; no pertenecen a `dist/`. Nunca publiques `.env` ni `.local/`.

## Bitácora

| Fecha | Incidencia | Resolución |
| --- | --- | --- |
| 2026-11-23 | Build y tipos dependían de la raíz. | Build, Nginx, tipos y recursos incorporados en web. |

## Ramas de trabajo

- `development`: rama activa para implementar y verificar cambios.
- `main`: rama reservada para versiones aprobadas para producción.

Antes de trabajar, ejecuta `git switch development`. Cuando una versión esté validada, intégrala desde `development` hacia `main` mediante un pull request. Después vuelve a `development`. No trabajes directamente sobre `main`.

El pipeline verifica y empaqueta cambios en `development` y `main`. El despliegue a producción desde `main` queda para una etapa posterior; no se despliega al actualizar una rama. Al publicar en GitHub, configura `development` como rama predeterminada y protege `main` para exigir revisión y verificaciones antes de integrar cambios.

## GitHub Actions y artefacto publicable

El workflow tiene dos jobs: **Verificar** instala las dependencias de desarrollo y ejecuta TypeScript y las pruebas; **Empaquetar** declara `needs: verificar`, por lo que solo comienza cuando el primero termina correctamente. Empaquetar obtiene el mismo código, prepara Node y sus dependencias en un runner nuevo, genera el paquete y lo guarda como artefacto. Si Verificar falla o se cancela, Empaquetar no continúa. Los jobs no comparten node_modules ni archivos locales; cada uno prepara su entorno.

El workflow `.github/workflows/ci.yml` se ejecuta con push y pull requests hacia `development` o `main`, y permite ejecución manual cuando el workflow esté disponible en la rama predeterminada. Instala con `npm ci`, verifica TypeScript, ejecuta pruebas independientes y genera el artefacto con `npm run package`. No necesita otros repositorios, secretos, PostgreSQL ni Mailpit para esta verificación; no realiza despliegues.

En **GitHub → Actions → ejecución exitosa → Artifacts** descarga el paquete identificado con el commit. Se conserva 14 días y contiene un `.tar.gz` y su checksum `.sha256`. Extrae el ZIP de descarga, verifica `sha256sum -c ARCHIVO.tar.gz.sha256` y descomprime el tar. Dentro encontrarás `PUBLICAR.md` y `release.json` con el commit, rama, versión de Node y plataforma. También puedes generar el paquete localmente mediante `npm run package`; en Linux requiere `tar`.

Los backends incluyen código TypeScript para Node.js 24, contratos, migraciones cuando corresponden y node_modules de producción instalados desde el lockfile. Web incluye `dist/` compilado y su launcher de Nginx. No incluye `.env` real, bases, PDF de usuarios, imágenes subidas, pruebas ni dependencias de desarrollo. Las fotografías públicas de demostración sí forman parte de web.

El artefacto de Actions se prepara en **Ubuntu 24.04 x64** para la versión exacta de `.nvmrc`. El destino requiere ese Node.js y un entorno compatible; web además requiere Nginx y los backends sus dependencias de infraestructura configuradas por entorno. No hace falta instalar paquetes npm ni compilar en destino. Conserva la persistencia fuera de la entrega y aplica las migraciones del servicio antes de arrancarlo.

## Dependencias de desarrollo y editor

Dentro de este repositorio ejecuta `npm ci --include=dev`: instala también TypeScript y los tipos `@types/node` ya declarados en package.json. No ejecutes npm install desde la carpeta que agrupa los ocho clones, porque no es un proyecto npm. La instalación con `--omit=dev` corresponde al artefacto de producción, no a editar el código fuente.

En VS Code abre la carpeta de este servicio, ejecuta **TypeScript: Select TypeScript Version → Use Workspace Version** y, si conservaba diagnósticos antiguos, **TypeScript: Restart TS Server**. `.vscode/settings.json` señala el TypeScript instalado en este proyecto. Comprueba los errores reales con `npm run typecheck`; `npm test` comprueba sus pruebas.

Las carpetas scripts, nginx y tests tienen su propio tsconfig.json, que extiende tsconfig.tools.json. Así el editor reconoce automáticamente esos proyectos Node, conservando la configuración React de src.
