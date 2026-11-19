const cache = new Map<string, HTMLCanvasElement>();

function hash(x: number, y: number, seed: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number, octaves = 6) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * smoothNoise(x * frequency, y * frequency, seed + i * 19);
    amplitude *= 0.52;
    frequency *= 2.05;
  }
  return value;
}

/** Distinct cloud colour profiles, tinted by sky and weather condition. */
export type CloudSpriteVariant =
  | "light"
  | "warm"
  | "grey"
  | "storm"
  | "wispy"
  | "night"
  | "twilight"
  | "twilight_layer"
  | "dusk_layer";

interface CloudRgb {
  r: number;
  g: number;
  b: number;
  alphaScale: number;
}

function cloudRgb(variant: CloudSpriteVariant, vertical: number): CloudRgb {
  const top = 1 - vertical * 0.45;

  switch (variant) {
    case "warm":
      return {
        r: 255,
        g: Math.round(252 + top * 3),
        b: Math.round(246 + top * 9),
        alphaScale: 0.9,
      };
    case "grey":
      return {
        r: Math.round(188 + top * 22),
        g: Math.round(194 + top * 24),
        b: Math.round(202 + top * 20),
        alphaScale: 0.88,
      };
    case "storm":
      return {
        r: Math.round(72 + top * 28),
        g: Math.round(82 + top * 32),
        b: Math.round(102 + top * 38),
        alphaScale: 0.9,
      };
    case "night":
      return {
        r: Math.round(48 + top * 40),
        g: Math.round(56 + top * 44),
        b: Math.round(78 + top * 52),
        alphaScale: 0.85,
      };
    case "twilight":
      return {
        r: Math.round(158 + top * 52),
        g: Math.round(150 + top * 48),
        b: Math.round(192 + top * 42),
        alphaScale: 0.62,
      };
    case "twilight_layer":
      return {
        r: Math.round(178 + top * 55),
        g: Math.round(170 + top * 50),
        b: Math.round(212 + top * 40),
        alphaScale: 0.72,
      };
    case "dusk_layer": {
      const warm = vertical;
      return {
        r: Math.round(210 + warm * 45 + top * 25),
        g: Math.round(215 - warm * 15 + top * 20),
        b: Math.round(235 - warm * 45 + top * 12),
        alphaScale: 0.68,
      };
    }
    case "wispy":
      return { r: 252, g: 254, b: 255, alphaScale: 0.62 };
    case "light":
    default:
      return {
        r: 252,
        g: Math.round(250 + top * 5),
        b: 255,
        alphaScale: 0.94,
      };
  }
}

function sampleDensity(
  px: number,
  py: number,
  width: number,
  height: number,
  seed: number,
  variant: CloudSpriteVariant,
) {
  const isLayer =
    variant === "twilight_layer" || variant === "wispy" || variant === "dusk_layer";
  const nxScale = isLayer ? 5.6 : variant === "twilight" ? 3.4 : 3.2;
  const nyScale = isLayer ? 1.15 : variant === "twilight" ? 2.1 : 2;

  const nx = (px / width) * nxScale + seed * 0.17;
  const ny = (py / height) * nyScale + seed * 0.11;
  let density = fbm(nx, ny, seed, isLayer ? 5 : 6);

  const centerY = isLayer ? 0.38 : variant === "twilight" ? 0.5 : 0.56;
  const cx = (px - width * 0.48) / (width * 0.42);
  const cy = (py - height * centerY) / (height * (isLayer ? 0.32 : 0.48));
  const envelopeStrength = isLayer ? 0.48 : variant === "twilight" ? 0.58 : 0.62;
  const envelope = Math.max(0, 1 - (cx * cx + cy * cy) * envelopeStrength);
  density *= envelope;

  const heightFade = isLayer
    ? 1 - Math.pow(Math.abs(py / height - 0.38) / 0.48, 1.25)
    : 1 - (py / height) * 0.28;
  density *= Math.max(0, heightFade);

  const threshold =
    isLayer ? 0.24 : variant === "twilight" ? 0.2 : variant === "storm" || variant === "night" ? 0.18 : 0.22;
  const power = isLayer ? 1.05 : variant === "storm" ? 0.75 : 0.88;
  return Math.pow(Math.max(0, density - threshold), power);
}

export function getCloudSprite(
  seed: number,
  width: number,
  height: number,
  variant: CloudSpriteVariant,
): HTMLCanvasElement {
  const key = `${seed}-${width}-${height}-${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const isLayer =
    variant === "twilight_layer" || variant === "wispy" || variant === "dusk_layer";

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const density = sampleDensity(px, py, width, height, seed, variant);
      const vertical = py / height;
      const { r, g, b, alphaScale } = cloudRgb(variant, vertical);
      const alpha = Math.min(1, density * (isLayer ? 1.55 : 1.55));

      const idx = (py * width + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.floor(alpha * 255 * alphaScale);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

export function clearCloudSpriteCache() {
  cache.clear();
}
