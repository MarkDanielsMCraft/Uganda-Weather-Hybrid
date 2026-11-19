#!/usr/bin/env node
/**
 * Builds data/districts/uganda-districts.json from EC-style district list + OSM centroids.
 * Sources: Uganda-Open-Data/kalulu CSV (146 districts), OpenStreetMap Overpass admin_level=4
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const existingPath = join(root, "data/districts/uganda-districts.json");
const outPath = join(root, "data/districts/uganda-districts.json");
const osmCachePath = join(root, "data/districts/osm-centroids.json");

const CSV_URL =
  "https://raw.githubusercontent.com/Uganda-Open-Data/kalulu/master/district_lookup/uganda_districts_2020.csv";

const REGION_MAP = {
  1: "central",
  2: "eastern",
  3: "northern",
  4: "western",
};

const POPULAR_RANK = {
  kampala: 1,
  wakiso: 2,
  jinja: 3,
  "jinja-city": 3,
  mbarara: 4,
  "mbarara-city": 4,
  gulu: 5,
  "gulu-city": 5,
  entebbe: 6,
  mbale: 7,
  "mbale-city": 7,
  mukono: 8,
  moroto: 12,
  kalangala: 15,
  bulambuli: 20,
};

const LAKE_VICTORIA = new Set([
  "buikwe",
  "buvuma",
  "entebbe",
  "jinja",
  "jinja-city",
  "kalangala",
  "kamuli",
  "kayunga",
  "mayuge",
  "mukono",
  "namayingo",
  "wakiso",
]);

/** Parliament-approved districts/cities not yet in the EC 146-district CSV. */
const SUPPLEMENTARY_DISTRICTS = [
  {
    id: "UG-CEN-ENB",
    name: "Entebbe",
    slug: "entebbe",
    region: "central",
    coordinates: { lat: 0.0512, lon: 32.4634 },
    popularRank: 6,
    isLakeVictoriaZone: true,
    isCity: true,
  },
  {
    id: "UG-EAS-TCC",
    name: "Tororo City",
    slug: "tororo-city",
    region: "eastern",
    coordinates: { lat: 0.6927, lon: 34.1809 },
    isCity: true,
  },
  {
    id: "UG-EAS-MKJ",
    name: "Mukuju",
    slug: "mukuju",
    region: "eastern",
    coordinates: { lat: 0.646, lon: 34.214 },
  },
  {
    id: "UG-EAS-MLD",
    name: "Mulanda",
    slug: "mulanda",
    region: "eastern",
    coordinates: { lat: 0.724, lon: 34.252 },
  },
  {
    id: "UG-EAS-KSK",
    name: "Kisoko",
    slug: "kisoko",
    region: "eastern",
    coordinates: { lat: 0.758, lon: 34.098 },
  },
  {
    id: "UG-WES-BGH",
    name: "Bughendera",
    slug: "bughendera",
    region: "western",
    coordinates: { lat: 0.848, lon: 30.214 },
    agroZone: "mountain",
    hazards: ["landslide", "lightning"],
  },
];

const KARAMOJA = new Set([
  "moroto",
  "kotido",
  "kaabong",
  "karenga",
  "napak",
  "nakapiripirit",
  "amudat",
  "abim",
]);

const WEST_NILE = new Set([
  "arua",
  "arua-city",
  "maracha",
  "koboko",
  "yumbe",
  "moyo",
  "adjumani",
  "zombo",
  "pakwach",
  "madi-okollo",
  "obongi",
  "terego",
]);

const MOUNTAIN = new Set([
  "kisoro",
  "kabale",
  "rubanda",
  "rukiga",
  "bundibugyo",
  "bunyangabu",
  "kapchorwa",
  "bududa",
  "manafwa",
  "bulambuli",
  "kween",
  "sirko",
  "sirono",
  "sironko",
  "namisindwa",
]);

const NAME_FIXES = {
  ssembabule: "Sembabule",
};

function displayName(raw) {
  const fixed = NAME_FIXES[normalizeName(raw)];
  return fixed ?? titleCase(raw);
}

function formatDistrictId(row, osmEntry, existingRecord) {
  if (existingRecord?.id && /^UG-\d{3}$/.test(existingRecord.id)) {
    return existingRecord.id;
  }
  const iso = osmEntry?.iso;
  if (iso && /^UG-\d{3}$/.test(iso)) return iso;
  return `UG-${String(row.code).padStart(3, "0")}`;
}

function titleCase(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+city$/i, "-city")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+city$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function inferAgroZone(slug, region) {
  if (KARAMOJA.has(slug)) return "karamoja";
  if (WEST_NILE.has(slug)) return "west_nile";
  if (MOUNTAIN.has(slug)) return "mountain";
  if (["soroti", "kumi", "katakwi", "kaberamaido", "amuria", "serere"].includes(slug)) return "teso";
  if (region === "northern") return "northern";
  if (region === "western") return "banana_millet_cotton";
  if (LAKE_VICTORIA.has(slug)) return "banana_coffee";
  if (region === "central") return "banana_coffee";
  return "banana_coffee";
}

function inferHazards(slug, region) {
  const hazards = [];
  if (LAKE_VICTORIA.has(slug) || ["kampala", "jinja", "jinja-city", "entebbe"].includes(slug)) {
    hazards.push("flood", "lightning");
  }
  if (MOUNTAIN.has(slug) || slug === "bulambuli" || slug === "bududa") {
    hazards.push("landslide");
  }
  if (KARAMOJA.has(slug) || region === "northern") {
    hazards.push("drought");
  }
  if (KARAMOJA.has(slug)) hazards.push("heat");
  if (hazards.length === 0) hazards.push("lightning");
  return [...new Set(hazards)];
}

function inferRainfall(region, slug) {
  if (region === "northern" || KARAMOJA.has(slug)) return "unimodal";
  return "bimodal";
}

async function fetchOverpass() {
  const query =
    '[out:json][timeout:90];area["ISO3166-1"="UG"]->.ug;relation["admin_level"="4"]["boundary"="administrative"](area.ug);out center tags;';

  try {
    const cached = readFileSync(osmCachePath, "utf8");
    const data = JSON.parse(cached);
    if (data.elements?.length) {
      console.log(`Using cached OSM centroids (${data.elements.length} relations)`);
      return parseOverpassElements(data.elements);
    }
  } catch {
    // no cache — fetch live
  }

  const mirrors = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  for (const base of mirrors) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "uganda-weather-build/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) break;
      const data = await res.json();
      writeFileSync(osmCachePath, `${JSON.stringify(data, null, 2)}\n`);
      return parseOverpassElements(data.elements ?? []);
    }
  }

  throw new Error("Overpass failed — run curl to refresh data/districts/osm-centroids.json");
}

function parseOverpassElements(elements) {
  const map = new Map();
  for (const el of elements) {
    if (!el.center?.lat || !el.tags?.name) continue;
    const key = normalizeName(el.tags.name);
    if (!map.has(key)) {
      map.set(key, {
        lat: el.center.lat,
        lon: el.center.lon,
        iso: el.tags["ISO3166-2"],
      });
    }
  }
  return map;
}

async function fetchCsv() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1);
  return lines.map((line) => {
    const [code, name, regionCode] = line.split(",");
    return {
      code: Number(code),
      name: name.trim(),
      region: REGION_MAP[Number(regionCode)],
    };
  });
}

async function nominatimCoords(name) {
  const q = encodeURIComponent(`${name}, Uganda`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "uganda-weather-build/1.0" } },
  );
  if (!res.ok) return null;
  const results = await res.json();
  if (!results[0]) return null;
  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}

async function main() {
  const existing = JSON.parse(readFileSync(existingPath, "utf8"));
  const existingBySlug = new Map(existing.districts.map((d) => [d.slug, d]));

  console.log("Fetching district list and OSM centroids...");
  const [csvRows, osmMap] = await Promise.all([fetchCsv(), fetchOverpass()]);
  console.log(`CSV: ${csvRows.length} districts, OSM: ${osmMap.size} centroids`);

  const districts = [];
  const missing = [];

  for (const row of csvRows) {
    const name = displayName(row.name);
    const slug = slugify(name);
    const existingRecord = existingBySlug.get(slug) ?? existingBySlug.get(slugify(row.name));
    const osmKey = normalizeName(name);
    let coords = existingRecord?.coordinates ?? osmMap.get(osmKey);

    if (!coords) {
      const altKey = normalizeName(row.name);
      coords = osmMap.get(altKey);
    }

    if (!coords) {
      missing.push(name);
    }

    const osmEntry = osmMap.get(osmKey) ?? osmMap.get(normalizeName(row.name));
    const id = formatDistrictId(row, osmEntry, existingRecord);

    districts.push({
      id,
      name,
      slug,
      region: row.region,
      coordinates: coords
        ? { lat: Number(coords.lat.toFixed(4)), lon: Number(coords.lon.toFixed(4)) }
        : { lat: 0, lon: 0 },
      rainfallPattern: existingRecord?.rainfallPattern ?? inferRainfall(row.region, slug),
      agroZone: existingRecord?.agroZone ?? inferAgroZone(slug, row.region),
      hazards: existingRecord?.hazards ?? inferHazards(slug, row.region),
      isCity: /city$/i.test(row.name),
      isLakeVictoriaZone: existingRecord?.isLakeVictoriaZone ?? LAKE_VICTORIA.has(slug),
      ...(POPULAR_RANK[slug] ? { popularRank: POPULAR_RANK[slug] } : {}),
      ...(existingRecord?.population ? { population: existingRecord.population } : {}),
    });
  }

  if (missing.length > 0) {
    console.log(`Geocoding ${missing.length} districts via Nominatim...`);
    for (const name of missing) {
      const coords = await nominatimCoords(name);
      const slug = slugify(name);
      const record = districts.find((d) => d.slug === slug);
      if (coords && record) {
        record.coordinates = {
          lat: Number(coords.lat.toFixed(4)),
          lon: Number(coords.lon.toFixed(4)),
        };
        console.log(`  ✓ ${name}`);
      } else {
        console.warn(`  ✗ ${name} — no coordinates`);
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  for (const city of SUPPLEMENTARY_DISTRICTS) {
    if (districts.some((district) => district.slug === city.slug)) continue;
    districts.push({
      id: city.id,
      name: city.name,
      slug: city.slug,
      region: city.region,
      coordinates: {
        lat: Number(city.coordinates.lat.toFixed(4)),
        lon: Number(city.coordinates.lon.toFixed(4)),
      },
      rainfallPattern: inferRainfall(city.region, city.slug),
      agroZone: city.agroZone ?? inferAgroZone(city.slug, city.region),
      hazards: city.hazards ?? inferHazards(city.slug, city.region),
      isCity: city.isCity ?? false,
      isLakeVictoriaZone: city.isLakeVictoriaZone ?? LAKE_VICTORIA.has(city.slug),
      ...(city.popularRank ? { popularRank: city.popularRank } : {}),
    });
  }

  const output = {
    meta: {
      version: "1.2.0",
      count: districts.length,
      note: "146 EC districts + 6 supplementary entries (Entebbe, Tororo City, Mukuju, Mulanda, Kisoko, Bughendera). Re-run scripts/build-districts.mjs to refresh.",
      source: "Uganda-Open-Data/kalulu, OpenStreetMap Overpass",
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    districts: districts.sort((a, b) => a.name.localeCompare(b.name)),
  };

  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  const noCoords = districts.filter((d) => d.coordinates.lat === 0);
  console.log(`Wrote ${districts.length} districts to ${outPath}`);
  if (noCoords.length) console.warn(`Still missing coords: ${noCoords.map((d) => d.name).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
