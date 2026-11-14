/**
 * Finaliza las compilaciones de Vite.
 *
 *   node scripts/finalize-build.mjs standalone
 *     Toma `standalone/dev.html` (la app completa en un solo archivo) y lo
 *     publica como `index.html` en la raíz del proyecto. Ese es el archivo
 *     que se abre con doble clic, sin ejecutables ni servidor local.
 *
 *   node scripts/finalize-build.mjs dist
 *     Renombra `dist/dev.html` a `dist/index.html` para publicar la versión
 *     multiarchivo en un servidor estático.
 */
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];

if (mode === "standalone") {
  const source = path.join(root, "standalone", "dev.html");
  const target = path.join(root, "index.html");
  const html = await readFile(source, "utf8");

  if (!html.includes("<div id=\"root\">")) {
    throw new Error("La compilación standalone no contiene el nodo #root.");
  }

  await writeFile(target, html, "utf8");
  await rm(path.join(root, "standalone"), { recursive: true, force: true });

  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log(`✓ index.html publicado (${kb} KB, autocontenido, sin servidor).`);
} else if (mode === "dist") {
  const source = path.join(root, "dist", "dev.html");
  const target = path.join(root, "dist", "index.html");
  await rename(source, target);
  console.log("✓ dist/index.html listo para publicar en un servidor estático.");
} else {
  throw new Error("Uso: node scripts/finalize-build.mjs <standalone|dist>");
}
