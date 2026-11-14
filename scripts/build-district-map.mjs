/**
 * Genera src/data/district-map.json con la geometría oficial de los 40
 * distritos legislativos de Nueva Jersey.
 *
 * Fuente: U.S. Census Bureau, TIGERweb — capa 1 (2026 State Legislative
 * Districts - Upper, que en Nueva Jersey coincide con los 40 distritos
 * legislativos usados por Senado y Asamblea).
 *
 * El script descarga la geometría en Web Mercator (EPSG:3857), la generaliza
 * a ~200 m para que el archivo sea ligero, la normaliza a un viewBox de
 * 1000 unidades y guarda un único path SVG por distrito (con huecos).
 *
 * Uso: node scripts/build-district-map.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src", "data", "district-map.json");

const SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/1/query";
const params = new URLSearchParams({
  where: "STATE='34'",
  outFields: "NAME,GEOID,BASENAME",
  returnGeometry: "true",
  f: "geojson",
  outSR: "3857",
  maxAllowableOffset: "200",
});

const response = await fetch(`${SERVICE}?${params}`, {
  headers: { "User-Agent": "WatchdogsMedia/1.0 (data build script)" },
});
if (!response.ok) throw new Error(`TIGERweb: HTTP ${response.status}`);
const geojson = await response.json();
if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
  throw new Error("TIGERweb no devolvió distritos.");
}

/* --------------------------------------------------------- normalización */
const ringsOf = (geometry) => {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Geometría no soportada: ${geometry.type}`);
};

let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;

for (const feature of geojson.features) {
  for (const polygon of ringsOf(feature.geometry)) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
}

const width = maxX - minX;
const height = maxY - minY;
const scale = 1000 / Math.max(width, height);
const round = (value) => Math.round(value * 10) / 10;

function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-9) return null;
  area /= 2;
  return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

const districts = [];

for (const feature of geojson.features) {
  const number = Number(feature.properties.BASENAME ?? feature.properties.GEOID?.slice(-2));
  if (!Number.isFinite(number)) continue;

  const parts = [];
  let labelCandidate = null;
  for (const polygon of ringsOf(feature.geometry)) {
    for (const ring of polygon) {
      if (ring.length < 3) continue;
      const normalized = ring.map(([x, y]) => [
        (x - minX) * scale,
        (maxY - y) * scale,
      ]);
      const points = normalized.map(([x, y]) => `${round(x)} ${round(y)}`);
      parts.push(`M${points.join("L")}Z`);
      const centroid = ringCentroid(normalized);
      if (centroid && (!labelCandidate || centroid.area > labelCandidate.area)) {
        labelCandidate = centroid;
      }
    }
  }

  districts.push({
    district: number,
    path: parts.join(""),
    label: labelCandidate
      ? [round(labelCandidate.x), round(labelCandidate.y)]
      : null,
  });
}

districts.sort((a, b) => a.district - b.district);

const missing = [];
for (let d = 1; d <= 40; d += 1) {
  if (!districts.some((item) => item.district === d)) missing.push(d);
}
if (missing.length) throw new Error(`Faltan distritos: ${missing.join(", ")}`);

const viewBox = `0 0 ${round(width * scale)} ${round(height * scale)}`;
const output = {
  source: {
    name: "U.S. Census Bureau · TIGERweb",
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/1",
    layer: "2026 State Legislative Districts - Upper",
    retrievedAt: new Date().toISOString(),
  },
  viewBox,
  districts,
};

await writeFile(target, `${JSON.stringify(output)}\n`, "utf8");

const kb = (Buffer.byteLength(JSON.stringify(output), "utf8") / 1024).toFixed(0);
console.log(`✓ district-map.json: ${districts.length} distritos, ${kb} KB, viewBox ${viewBox}`);
