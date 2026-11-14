/**
 * Auditoría de traducciones.
 *
 * 1. Comprueba que cada clave exista en inglés y español.
 * 2. Detecta claves definidas que ningún archivo usa.
 * 3. Detecta marcadores {variable} que no coincidan entre idiomas.
 *
 * Uso:
 *   node scripts/check-i18n.mjs             # falla si hay claves muertas
 *   node scripts/check-i18n.mjs --allow-unused
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nPath = path.join(root, "src", "lib", "i18n.tsx");
const allowUnused = process.argv.includes("--allow-unused");

function parseDictionary(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`No se encontró ${startMarker}`);
  const slice = source.slice(start);
  const closeMatch = slice.match(/\r?\n\}\s*(?:as\s+const\s*)?;/);
  if (!closeMatch || closeMatch.index === undefined) throw new Error(`No se encontró el cierre de ${startMarker}`);
  const end = start + closeMatch.index;
  const block = source.slice(start, end);
  const keyPattern = /"([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)"\s*:/g;
  const matches = [...block.matchAll(keyPattern)];
  const entries = new Map();
  matches.forEach((match, index) => {
    const entryEnd =
      index + 1 < matches.length ? matches[index + 1].index : block.length;
    entries.set(match[1], block.slice(match.index, entryEnd));
  });
  return entries;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const source = await readFile(i18nPath, "utf8");
const en = parseDictionary(source, "const en = {");
const es = parseDictionary(source, "const es: Record<CopyKey, string> = {");

const files = (await walk(path.join(root, "src"))).filter(
  (file) => file !== i18nPath,
);
const code = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join(
  "\n",
);

const markers = (value) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");

const errors = [];
const warnings = [];

for (const key of en.keys()) {
  if (!es.has(key)) errors.push(`Falta en español: ${key}`);
}
for (const key of es.keys()) {
  if (!en.has(key)) errors.push(`Sobra en español: ${key}`);
}

for (const [key, line] of en) {
  if (!es.has(key)) continue;
  const enMarkers = markers(line);
  const esMarkers = markers(es.get(key));
  if (enMarkers !== esMarkers) {
    errors.push(
      `Marcadores distintos en ${key}: EN {${enMarkers}} vs ES {${esMarkers}}`,
    );
  }
}

for (const key of en.keys()) {
  if (!code.includes(`"${key}"`)) warnings.push(`Clave sin uso: ${key}`);
}

console.log(`Claves EN: ${en.size} · ES: ${es.size} · archivos: ${files.length}`);
if (errors.length) {
  console.log(`\n${errors.length} errores:`);
  for (const error of errors) console.log(`  ✗ ${error}`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} advertencias:`);
  for (const warning of warnings) console.log(`  · ${warning}`);
}
if (!errors.length && (!warnings.length || allowUnused)) {
  console.log("\n✓ Traducciones consistentes.");
}

process.exitCode = errors.length || (!allowUnused && warnings.length) ? 1 : 0;
