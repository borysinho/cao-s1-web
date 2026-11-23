import { copyFile, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const file = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
await build({
  entryPoints: [file("../src/main.tsx")],
  outfile: file("../dist/assets/main.js"),
  tsconfig: file("../tsconfig.json"),
  bundle: true,
  minify: true,
  external: ["/concierto.webp"],
  loader: { ".woff2": "file", ".woff": "file" },
  define: { "process.env.NODE_ENV": '"production"' },
});
await copyFile(file("../index.html"), file("../dist/index.html"));

await cp(file("../public/"), file("../dist/"), { recursive: true });
