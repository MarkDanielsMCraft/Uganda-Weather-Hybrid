/**
 * Regenerates `UGANDA_OUTLINE_PATH` in src/lib/design/brand-mark.ts from the
 * real national boundary, so the logo's country is traced rather than drawn
 * from memory.
 *
 * Source: Natural Earth 1:10m admin-0 countries, public domain, shipped in
 * the `world-atlas` package as TopoJSON. Natural Earth asks for no
 * attribution and places no restriction on use.
 *
 * The two packages this needs are not project dependencies: a national
 * border does not move, so there is no reason to carry ~5 MB of boundary
 * data through every install and CI run for a file regenerated approximately
 * never. Install them for the one run and drop them again:
 *
 *   npm i --no-save world-atlas topojson-client
 *   node scripts/build-uganda-outline.mjs
 *
 * Paste the printed path into brand-mark.ts, then regenerate the icons and
 * bump ICON_VERSION in src/app/layout.tsx and CACHE in public/sw.js.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let feature;
let atlasPath;
try {
  ({ feature } = require("topojson-client"));
  atlasPath = require.resolve("world-atlas/countries-10m.json");
} catch {
  console.error(
    "Missing boundary data. Run:\n  npm i --no-save world-atlas topojson-client",
  );
  process.exit(1);
}

/** Uganda's numeric ISO 3166-1 code, which is what Natural Earth keys on. */
const UGANDA_ISO = "800";

/** Where the country sits inside the 512 viewBox the mark is drawn in. */
const BOX = { x: 26, y: 16, w: 460, h: 480 };

/** Ramer-Douglas-Peucker tolerance, in viewBox units. 2.6 takes the 607
    source vertices down to 80: enough to keep the Lake Albert notch, the
    West Nile lobe and the Kidepo point, few enough that the shape stays
    crisp at favicon size. */
const TOLERANCE = 2.6;

/** Corner fillet radius. Straight runs of border stay straight. */
const FILLET = 3;

const topo = JSON.parse(readFileSync(atlasPath, "utf8"));
const countries = feature(topo, topo.objects.countries);
const uganda = countries.features.find((f) => String(f.id) === UGANDA_ISO);

if (!uganda) {
  console.error(`No country with ISO ${UGANDA_ISO} in the boundary data.`);
  process.exit(1);
}

const ring = uganda.geometry.coordinates[0];

// Equirectangular. Uganda straddles the equator, so a degree of longitude
// and a degree of latitude are the same length here to within 0.03 percent.
const lons = ring.map((p) => p[0]);
const lats = ring.map((p) => p[1]);
const minLon = Math.min(...lons);
const maxLon = Math.max(...lons);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const spanLon = maxLon - minLon;
const spanLat = maxLat - minLat;
const scale = Math.min(BOX.w / spanLon, BOX.h / spanLat);
const offsetX = BOX.x + (BOX.w - spanLon * scale) / 2;
const offsetY = BOX.y + (BOX.h - spanLat * scale) / 2;

const points = ring.map(([lon, lat]) => [
  offsetX + (lon - minLon) * scale,
  offsetY + (maxLat - lat) * scale,
]);

function squaredDistanceToSegment(point, start, end) {
  let [x, y] = start;
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = end;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(input, tolerance) {
  const squared = tolerance * tolerance;
  const keep = new Uint8Array(input.length);
  keep[0] = 1;
  keep[input.length - 1] = 1;
  const stack = [[0, input.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = squaredDistanceToSegment(input[i], input[first], input[last]);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > squared) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return input.filter((_, i) => keep[i]);
}

function toPath(input, radius) {
  const total = input.length;
  const at = (i) => input[(i + total) % total];
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const format = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

  let d = "";
  for (let i = 0; i < total; i++) {
    const previous = at(i - 1);
    const current = at(i);
    const next = at(i + 1);
    const inLength = distance(previous, current);
    const outLength = distance(current, next);
    if (inLength === 0 || outLength === 0) continue;
    const from = lerp(current, previous, Math.min(radius, inLength / 2) / inLength);
    const to = lerp(current, next, Math.min(radius, outLength / 2) / outLength);
    d += `${d ? "L" : "M"}${format(from)}Q${format(current)} ${format(to)}`;
  }
  return `${d}Z`;
}

const simplified = simplify(points, TOLERANCE);
console.error(`${ring.length} source vertices -> ${simplified.length} after simplify`);
console.log(toPath(simplified, FILLET));
