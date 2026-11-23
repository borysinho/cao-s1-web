import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try { process.loadEnvFile(new URL('../.env', import.meta.url)); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const project = fileURLToPath(new URL("..", import.meta.url));
const local = resolve(
  process.env.ENTRADASYA_LOCAL_DIR ?? join(project, ".local"),
);
const prefix = join(local, "nginx");
const build = resolve(process.env.WEB_DIST ?? join(project, "dist"));
const bundled = join(project, ".local/tools/nginx/usr/bin/nginx");
const command =
  process.env.NGINX_BIN ?? (existsSync(bundled) ? bundled : "nginx");

function quote(path: string) {
  if (/["\\$\r\n]/.test(path))
    throw new Error("La ruta de Nginx contiene caracteres no admitidos.");
  return '"' + path + '"';
}
function port(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error("Puerto inválido para " + name);
  return value;
}

const apiRoutes = [
  ["^/api/auth/(register|login)$", "AUTH_PORT", 3001],
  ["^/api/events(/.*)?$", "EVENTS_PORT", 3002],
  ["^/api/orders(/.*)?$", "ORDERS_PORT", 3003],
  ["^/api/tickets(/.*)?$", "TICKETS_PORT", 3005],
  ["^/api/checkins(/.*)?$", "CHECKIN_PORT", 3007],
] as const;
const routes = apiRoutes
  .map(
    ([path, name, fallback]) => `
    location ~ ${path} {
      proxy_pass http://127.0.0.1:${port(name, fallback)};
    }`,
  )
  .join("\n");

export const options = `
daemon off;
pid nginx.pid;
error_log stderr warn;
events {}
http {
  access_log off;
  server_tokens off;
  client_body_temp_path client_body;
  proxy_temp_path proxy;
  fastcgi_temp_path fastcgi;
  uwsgi_temp_path uwsgi;
  scgi_temp_path scgi;
  default_type application/octet-stream;
  types {
    text/html html;
    text/css css;
    application/javascript js;
    image/webp webp;
    font/woff2 woff2;
    font/woff woff;
  }
  server {
    listen 127.0.0.1:${port("WEB_PORT", 8080)};
    root ${quote(build)};
    add_header X-Content-Type-Options nosniff always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' http: https: blob:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    client_max_body_size 8m;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Idempotency-Key $http_idempotency_key;
    proxy_set_header X-Internal-Token "";
    proxy_read_timeout 24s;
    location = /health {
      default_type application/json;
      if (!-f $document_root/index.html) { return 503 '{"status":"unavailable"}'; }
      if (!-f $document_root/assets/main.js) { return 503 '{"status":"unavailable"}'; }
      if (!-f $document_root/assets/main.css) { return 503 '{"status":"unavailable"}'; }
      return 200 '{"status":"ok"}';
    }
    ${routes}
    location /api/ { default_type application/json; return 404 '{"code":"NOT_FOUND","message":"Ruta inexistente."}'; }
    location = /api { return 404; }
    location = /internal { return 404; }
    location ^~ /internal/ { return 404; }
    location = /index.html { try_files /index.html =503; }
    location ^~ /assets/ { try_files $uri =404; }
    location / { try_files $uri /index.html; }
  }
}
`;

await mkdir(prefix, { recursive: true, mode: 0o700 });
const config = join(prefix, "nginx.conf");
await writeFile(config, options, { mode: 0o600 });
const args = ["-e", "stderr", "-p", prefix + "/", "-c", config];
if (process.argv.includes("--check")) args.push("-t");
const bundledLibs = join(project, ".local/tools/nginx/usr/lib64");
const env =
  command === bundled
    ? {
        ...process.env,
        LD_LIBRARY_PATH: [bundledLibs, process.env.LD_LIBRARY_PATH]
          .filter(Boolean)
          .join(":"),
      }
    : process.env;
const child = spawn(command, args, { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    child.kill("SIGTERM");
  });
}
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGTERM" ? 0 : 1);
});
