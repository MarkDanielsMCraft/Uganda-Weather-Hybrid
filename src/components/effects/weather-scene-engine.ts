import type { WeatherTheme } from "@/types/weather";
import { FrameBudget } from "./frame-budget";
import {
  sceneThemeFor,
  shouldDrawFogLayer,
  shouldDrawNightSky,
  shouldDrawSun,
} from "@/lib/weather/conditions";
import { moonRenderParams } from "@/lib/weather/moon-render";
import { SKY_GRADIENTS, WEATHER_PALETTE as P } from "@/lib/design/weather-palette";
import {
  clearCloudSpriteCache,
  getCloudSprite,
  type CloudSpriteVariant,
} from "./cloud-sprites";
import { getEquatorialSunPosition } from "@/lib/weather/solar-ephemeris";

export interface SceneConfig {
  theme: WeatherTheme;
  isDay?: boolean;
  liteMode?: boolean;
  rainIntensity?: number;
  windDegree?: number;
  moonIllumination?: number;
  moonPhase?: string;
  cardTopY?: number;
}

interface SkyPalette {
  stops: [number, string][];
}

const SKY: Record<WeatherTheme, SkyPalette> = Object.fromEntries(
  Object.entries(SKY_GRADIENTS).map(([theme, stops]) => [theme, { stops }]),
) as Record<WeatherTheme, SkyPalette>;

const NIGHT_RAIN_SKY: SkyPalette = {
  stops: [
    [0, "#060912"],
    [0.35, "#0c121e"],
    [0.65, "#121a2a"],
    [1, "#030408"],
  ],
};

const NIGHT_CLOUDY_SKY: SkyPalette = {
  stops: [
    [0, "#0a0c16"],
    [0.35, "#121824"],
    [0.65, "#161e2e"],
    [1, "#05060a"],
  ],
};

const NIGHT_FOG_SKY: SkyPalette = {
  stops: [
    [0, "#0c101a"],
    [0.35, "#182030"],
    [0.65, "#1e283c"],
    [1, "#080a10"],
  ],
};

interface Cloud {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  layer: number;
  opacity: number;
  variant: CloudSpriteVariant;
}

export interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  layer: number;
}

export interface RainSplash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  twinkleSpeed: number;
  tint: number;
}

export interface LightningBolt {
  startX: number;
  startY: number;
  points: { x: number; y: number }[];
  branches: { x: number; y: number }[][];
  life: number;
  maxLife: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function slotX(index: number, total: number, width: number, cloudWidth: number) {
  const span = width + cloudWidth * 0.5;
  const step = span / Math.max(total, 1);
  return step * index - cloudWidth * 0.15 + randomBetween(-step * 0.1, step * 0.1);
}

function bandY(
  band: { yMin: number; yMax: number },
  height: number,
  cloudHeight: number,
) {
  const minY = height * band.yMin;
  const maxY = height * band.yMax - cloudHeight * 0.35;
  return randomBetween(minY, Math.max(minY + 4, maxY));
}

/** Clouds only in mid-sky bands, top stays clear. */
const SKY_BANDS: Record<WeatherTheme, { yMin: number; yMax: number }[]> = {
  clear: [
    { yMin: 0.14, yMax: 0.24 },
    { yMin: 0.20, yMax: 0.30 },
  ],
  partly_cloudy: [
    { yMin: 0.18, yMax: 0.30 },
    { yMin: 0.24, yMax: 0.36 },
    { yMin: 0.30, yMax: 0.42 },
    { yMin: 0.36, yMax: 0.48 },
    { yMin: 0.42, yMax: 0.54 },
  ],
  cloudy: [
    { yMin: 0.03, yMax: 0.14 },
    { yMin: 0.10, yMax: 0.22 },
    { yMin: 0.18, yMax: 0.32 },
    { yMin: 0.28, yMax: 0.42 },
    { yMin: 0.38, yMax: 0.52 },
  ],
  rain: [
    { yMin: 0.02, yMax: 0.12 },
    { yMin: 0.08, yMax: 0.20 },
    { yMin: 0.16, yMax: 0.28 },
    { yMin: 0.24, yMax: 0.36 },
  ],
  thunder: [
    { yMin: 0.02, yMax: 0.11 },
    { yMin: 0.08, yMax: 0.18 },
    { yMin: 0.14, yMax: 0.26 },
    { yMin: 0.22, yMax: 0.34 },
    { yMin: 0.30, yMax: 0.40 },
  ],
  fog: [
    { yMin: 0.06, yMax: 0.18 },
    { yMin: 0.14, yMax: 0.28 },
    { yMin: 0.22, yMax: 0.38 },
    { yMin: 0.32, yMax: 0.50 },
  ],
  night: [
    { yMin: 0.10, yMax: 0.20 },
    { yMin: 0.14, yMax: 0.26 },
    { yMin: 0.20, yMax: 0.32 },
    { yMin: 0.26, yMax: 0.38 },
    { yMin: 0.32, yMax: 0.44 },
  ],
};

function cloudPlan(theme: WeatherTheme) {
  const base = { wispy: 0, layers: 0, layerVariant: "twilight_layer" as CloudSpriteVariant };
  switch (theme) {
    case "clear":
      return { ...base, count: 0, variant: "wispy" as CloudSpriteVariant, wispy: 2, tone: 0.38 };
    case "partly_cloudy":
      return {
        ...base,
        count: 0,
        variant: "wispy" as CloudSpriteVariant,
        layers: 5,
        layerVariant: "dusk_layer" as CloudSpriteVariant,
        tone: 0.82,
      };
    case "cloudy":
      return { ...base, count: 6, variant: "grey" as CloudSpriteVariant, wispy: 2, tone: 0.82 };
    case "rain":
      return { ...base, count: 7, variant: "storm" as CloudSpriteVariant, tone: 0.88 };
    case "thunder":
      return { ...base, count: 8, variant: "storm" as CloudSpriteVariant, tone: 0.92 };
    case "fog":
      return { ...base, count: 4, variant: "grey" as CloudSpriteVariant, wispy: 3, tone: 0.55 };
    case "night":
      return {
        ...base,
        count: 0,
        variant: "twilight" as CloudSpriteVariant,
        layers: 4,
        layerVariant: "twilight_layer" as CloudSpriteVariant,
        tone: 0.72,
      };
    default:
      return { ...base, count: 4, variant: "light" as CloudSpriteVariant, wispy: 2, tone: 0.8 };
  }
}

function buildClouds(theme: WeatherTheme, width: number, height: number): Cloud[] {
  const plan = cloudPlan(theme);
  const bands = SKY_BANDS[theme] ?? SKY_BANDS.partly_cloudy;
  const clouds: Cloud[] = [];
  const totalSlots = plan.count + plan.wispy + plan.layers;

  for (let i = 0; i < plan.count; i += 1) {
    const layer = i % 3;
    const band = bands[i % bands.length];
    const upperBand = band.yMax <= 0.28;
    const isTwilight = plan.variant === "twilight";
    const scale =
      randomBetween(upperBand ? 0.55 : 0.85, upperBand ? 0.82 : 1.3) *
      (plan.variant === "storm" ? 1.15 : 1);
    const spriteWidth = Math.round(randomBetween(upperBand ? 360 : 480, upperBand ? 560 : 720) * scale);
    const spriteHeight = Math.round(
      spriteWidth * (isTwilight ? randomBetween(0.22, 0.3) : randomBetween(0.32, 0.42)),
    );
    const sprite = getCloudSprite(i * 13 + theme.length * 7, spriteWidth, spriteHeight, plan.variant);

    clouds.push({
      sprite,
      x: slotX(i, totalSlots, width, spriteWidth),
      y: bandY(band, height, spriteHeight),
      width: spriteWidth,
      height: spriteHeight,
      speed: randomBetween(4, 10) * (layer === 0 ? 0.45 : layer === 1 ? 0.7 : 1),
      layer,
      opacity: plan.tone * (layer === 0 ? 0.75 : layer === 1 ? 0.88 : 1),
      variant: plan.variant,
    });
  }

  for (let i = 0; i < plan.layers; i += 1) {
    const band = bands[i % bands.length];
    const layerVariant = plan.layerVariant ?? "twilight_layer";
    const spriteWidth = Math.round(width * randomBetween(1.15, 1.48));
    const spriteHeight = Math.round(spriteWidth * randomBetween(0.12, 0.17));
    const sprite = getCloudSprite(200 + i * 37, spriteWidth, spriteHeight, layerVariant);

    clouds.push({
      sprite,
      x: slotX(plan.count + i, totalSlots, width, spriteWidth) - width * 0.06,
      y: bandY(band, height, spriteHeight),
      width: spriteWidth,
      height: spriteHeight,
      speed: randomBetween(2, 4.5),
      layer: i % 3,
      opacity: plan.tone * (0.92 + i * 0.03),
      variant: layerVariant,
    });
  }

  for (let i = 0; i < plan.wispy; i += 1) {
    const wispyVariant: CloudSpriteVariant = theme === "night" ? "twilight_layer" : "wispy";
    const band = bands[i % bands.length];
    const spriteWidth = Math.round(randomBetween(width * 0.55, width * 0.95));
    const spriteHeight = Math.round(spriteWidth * 0.18);
    const sprite = getCloudSprite(100 + i * 29, spriteWidth, spriteHeight, wispyVariant);
    const wispySlot = plan.count + plan.layers + i;

    clouds.push({
      sprite,
      x: slotX(wispySlot, totalSlots, width, spriteWidth),
      y: bandY(band, height, spriteHeight),
      width: spriteWidth,
      height: spriteHeight,
      speed: randomBetween(4, 8),
      layer: 1,
      opacity: theme === "clear" ? 0.42 : 0.48,
      variant: wispyVariant,
    });
  }

  return clouds;
}

export function buildRain(width: number, height: number, intensity: number): RainDrop[] {
  const count = Math.min(420, Math.round(120 + intensity * 40));
  const drops: RainDrop[] = [];
  const lead = height * 0.45 + 50;
  for (let i = 0; i < count; i += 1) {
    const layer = i % 3;
    drops.push({
      x: randomBetween(-lead, width + lead),
      y: Math.random() * height,
      length: layer === 2 ? randomBetween(14, 26) : layer === 1 ? randomBetween(10, 18) : randomBetween(6, 12),
      speed: layer === 2 ? randomBetween(14, 22) : layer === 1 ? randomBetween(9, 14) : randomBetween(5, 9),
      opacity: layer === 2 ? randomBetween(0.35, 0.55) : layer === 1 ? randomBetween(0.2, 0.38) : randomBetween(0.08, 0.18),
      layer,
    });
  }
  return drops;
}

export function buildStars(width: number, height: number, count = 100): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.58,
      size: Math.random() < 0.12 ? 2.1 : 1.1,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: randomBetween(0.8, 2.4),
      tint: Math.random(),
    });
  }
  return stars;
}

export function generateLightning(width: number, height: number): LightningBolt {
  const startX = randomBetween(width * 0.25, width * 0.75);
  const startY = -10;
  const points = [{ x: startX, y: startY }];
  const branches: { x: number; y: number }[][] = [];
  let x = startX;
  let y = startY;
  const targetY = randomBetween(height * 0.32, height * 0.6);

  while (y < targetY) {
    const dx = randomBetween(-26, 26);
    const dy = randomBetween(18, 40);
    x += dx;
    y += dy;
    points.push({ x, y });

    // 35% chance to fork a sub-branch
    if (Math.random() < 0.35 && branches.length < 3 && y < targetY - 40) {
      let bx = x;
      let by = y;
      const branchPoints = [{ x: bx, y: by }];
      const branchDir = dx >= 0 ? 1 : -1;
      const branchSteps = Math.floor(randomBetween(2, 4));
      for (let s = 0; s < branchSteps; s++) {
        bx += branchDir * randomBetween(14, 28) + randomBetween(-6, 6);
        by += randomBetween(12, 24);
        branchPoints.push({ x: bx, y: by });
      }
      branches.push(branchPoints);
    }
  }

  return { startX, startY, points, branches, life: 0, maxLife: 0.26 };
}

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, theme: WeatherTheme, isDay = true) {
  let palette = SKY[theme];
  if (!isDay) {
    if (theme === "rain" || theme === "thunder") {
      palette = NIGHT_RAIN_SKY;
    } else if (theme === "cloudy") {
      palette = NIGHT_CLOUDY_SKY;
    } else if (theme === "fog") {
      palette = NIGHT_FOG_SKY;
    }
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const [stop, color] of palette.stops) {
    gradient.addColorStop(stop, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawSun(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
  time: number,
) {
  const ephemeris = getEquatorialSunPosition();
  if (!ephemeris.isDaylight) return;

  const effectiveStrength = strength * ephemeris.strength;
  const cx = width * ephemeris.x;
  const cy = height * (1 - ephemeris.y);
  const [bir, big, bib] = P.sun.bloomInner;
  const [bmr, bmg, bmb] = P.sun.bloomMid;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 1. Crepuscular sunbeams (god rays) radiating across the equatorial sky
  const rayCount = 7;
  for (let r = 0; r < rayCount; r++) {
    const baseAngle = (r / rayCount) * Math.PI + 0.16;
    const rayAlpha = Math.max(0, 0.024 + Math.sin(time * 0.0005 + r * 1.25) * 0.016) * effectiveStrength;
    const rayLength = Math.max(width, height) * 1.5;
    const spread = 0.075;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(baseAngle - spread) * rayLength, cy + Math.sin(baseAngle - spread) * rayLength);
    ctx.lineTo(cx + Math.cos(baseAngle + spread) * rayLength, cy + Math.sin(baseAngle + spread) * rayLength);
    ctx.closePath();
    const rayGrad = ctx.createRadialGradient(cx, cy, width * 0.06, cx, cy, rayLength);
    rayGrad.addColorStop(0, `rgba(255, 232, 160, ${rayAlpha * 1.6})`);
    rayGrad.addColorStop(0.35, `rgba(255, 200, 100, ${rayAlpha})`);
    rayGrad.addColorStop(1, "rgba(255, 180, 80, 0)");
    ctx.fillStyle = rayGrad;
    ctx.fill();
    ctx.restore();
  }

  // 2. Wide ambient sky wash
  const skyWash = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.85);
  skyWash.addColorStop(0, `rgba(255, 190, 40, ${0.22 * effectiveStrength})`);
  skyWash.addColorStop(0.12, `rgba(255, 195, 75, ${0.16 * effectiveStrength})`);
  skyWash.addColorStop(0.3, `rgba(255, 175, 60, ${0.08 * effectiveStrength})`);
  skyWash.addColorStop(0.55, `rgba(240, 155, 50, ${0.03 * effectiveStrength})`);
  skyWash.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = skyWash;
  ctx.fillRect(0, 0, width, height);

  // 3. Harmonic bloom breathing (+/- 4% on 8s period)
  const bloomOsc = 1 + Math.sin(time * 0.00078) * 0.04;
  const blooms = [
    { radius: width * 0.58 * bloomOsc, peak: 0.13 },
    { radius: width * 0.34 * bloomOsc, peak: 0.22 },
    { radius: width * 0.16 * bloomOsc, peak: 0.32 },
  ];

  for (const bloom of blooms) {
    const gradient = ctx.createRadialGradient(cx, cy, bloom.radius * 0.06, cx, cy, bloom.radius);
    gradient.addColorStop(0, `rgba(${bir}, ${big}, ${bib}, ${bloom.peak * effectiveStrength})`);
    gradient.addColorStop(0.2, `rgba(${bmr}, ${bmg}, ${bmb}, ${bloom.peak * 0.75 * effectiveStrength})`);
    gradient.addColorStop(0.45, `rgba(255, 155, 40, ${bloom.peak * 0.32 * effectiveStrength})`);
    gradient.addColorStop(0.7, `rgba(255, 140, 30, ${bloom.peak * 0.08 * effectiveStrength})`);
    gradient.addColorStop(1, "rgba(255, 120, 20, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Core solar disk
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.055);
  core.addColorStop(0, `rgba(255, 238, 155, ${0.92 * effectiveStrength})`);
  core.addColorStop(0.35, `rgba(255, 204, 0, ${0.6 * effectiveStrength})`);
  core.addColorStop(0.65, `rgba(255, 184, 0, ${0.2 * effectiveStrength})`);
  core.addColorStop(1, "rgba(255, 149, 0, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(cx - width * 0.1, cy - width * 0.1, width * 0.2, width * 0.2);

  // 5. Axial lens flare ghost drift
  const ghostWobble = Math.sin(time * 0.00045) * 0.015;
  const ghosts = [
    { dx: -0.26 + ghostWobble, dy: 0.3 + ghostWobble, r: 0.03, alpha: 0.1 },
    { dx: -0.16 - ghostWobble, dy: 0.2 - ghostWobble, r: 0.018, alpha: 0.06 },
    { dx: -0.4 + ghostWobble * 1.5, dy: 0.46 + ghostWobble * 1.5, r: 0.042, alpha: 0.05 },
  ];
  for (const ghost of ghosts) {
    const gx = cx + width * ghost.dx;
    const gy = cy + height * ghost.dy;
    const gr = width * ghost.r;
    const flare = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    flare.addColorStop(0, `rgba(255, 210, 100, ${ghost.alpha * effectiveStrength})`);
    flare.addColorStop(0.55, `rgba(255, 185, 70, ${ghost.alpha * 0.35 * effectiveStrength})`);
    flare.addColorStop(1, "rgba(255, 160, 50, 0)");
    ctx.fillStyle = flare;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  ctx.restore();
}

function drawMoon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  illumination = 49,
  moonPhase = "Last Quarter",
) {
  const { lit, waning } = moonRenderParams(illumination, moonPhase);
  if (lit <= 0.02) return;

  const cx = width * 0.74;
  const cy = height * 0.14;
  const radius = 32;

  ctx.save();

  const halo = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2.8);
  halo.addColorStop(0, P.moon.halo);
  halo.addColorStop(1, "rgba(200, 215, 255, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cx - radius * 3, cy - radius * 3, radius * 6, radius * 6);

  const moon = ctx.createRadialGradient(cx - 6, cy - 6, 1, cx, cy, radius);
  moon.addColorStop(0, P.moon.lit);
  moon.addColorStop(0.55, P.moon.fill);
  moon.addColorStop(1, P.moon.shadow);
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  if (lit < 0.97) {
    const shadowOffset = (waning ? -1 : 1) * radius * (1 - lit) * 1.85;
    const shadow = ctx.createRadialGradient(cx + shadowOffset, cy - 2, 2, cx + shadowOffset, cy - 2, radius);
    shadow.addColorStop(0, SKY.night.stops[1][1]);
    shadow.addColorStop(1, SKY.night.stops[0][1]);
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(cx + shadowOffset + (waning ? -1 : 1), cy - 1, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], height: number, time: number) {
  const width = ctx.canvas.width;
  ctx.save();
  for (const star of stars) {
    const baseTwinkle = 0.45 + Math.sin(time * 0.001 * star.twinkleSpeed + star.phase) * 0.4;
    // Horizon attenuation: extinguish stars below 68% height to prevent shining through dense haze
    const horizonFactor = star.y < height * 0.45
      ? 1
      : Math.max(0, 1 - (star.y - height * 0.45) / (height * 0.25));
    const twinkle = Math.min(0.95, Math.max(0.08, baseTwinkle * horizonFactor));

    if (twinkle <= 0.05) continue;

    const cool = star.tint > 0.5;
    const r = cool ? 200 : 255;
    const g = cool ? 220 : 248;
    const b = cool ? 255 : 232;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${twinkle})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Periodic celestial meteor trail (every 9s, lasting 650ms)
  const cycleMs = 9000;
  const phaseMs = time % cycleMs;
  if (phaseMs < 650) {
    const t = phaseMs / 650;
    const meteorX = width * 0.72 - t * width * 0.36;
    const meteorY = height * 0.10 + t * height * 0.22;
    const tailX = meteorX + width * 0.08;
    const tailY = meteorY - height * 0.049;
    const alpha = Math.sin(t * Math.PI) * 0.85;

    const grad = ctx.createLinearGradient(meteorX, meteorY, tailX, tailY);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(1, "rgba(200, 220, 255, 0)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(meteorX, meteorY);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud, theme: WeatherTheme) {
  ctx.save();

  const litSky = theme === "clear" || theme === "partly_cloudy" || theme === "fog";
  const stormSky = theme === "rain" || theme === "thunder";
  const twilight =
    cloud.variant === "twilight" ||
    cloud.variant === "twilight_layer" ||
    cloud.variant === "dusk_layer";

  if (twilight) {
    ctx.globalCompositeOperation = "screen";
    const layerAlpha =
      cloud.variant === "dusk_layer" ? 0.88 : cloud.variant === "twilight_layer" ? 0.9 : 0.86;
    ctx.globalAlpha = Math.min(1, cloud.opacity * layerAlpha);
  } else if (litSky && (cloud.variant === "light" || cloud.variant === "warm" || cloud.variant === "wispy")) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = cloud.opacity * 0.82;
  } else if (stormSky || cloud.variant === "storm" || cloud.variant === "night") {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cloud.opacity * (theme === "thunder" ? 0.95 : 0.88);
  } else {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = cloud.opacity * 0.78;
  }

  ctx.drawImage(cloud.sprite, cloud.x, cloud.y, cloud.width, cloud.height);
  ctx.restore();
}

export function drawFog(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const puffCount = 6;
  for (let i = 0; i < puffCount; i += 1) {
    const y = height * (0.22 + i * 0.07);
    const rx = width * (0.32 + (i % 3) * 0.08);
    const ry = height * 0.08;
    const speed = 0.00012 * (1 + (i % 2) * 0.4);
    const drift = ((time * speed * width + (i * width * 0.35)) % (width + rx * 2)) - rx;
    const alpha = 0.16 + (i % 3) * 0.04;

    ctx.save();
    ctx.translate(drift, y);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, `rgba(235, 242, 250, ${alpha})`);
    grad.addColorStop(0.5, `rgba(220, 230, 242, ${alpha * 0.5})`);
    grad.addColorStop(1, "rgba(210, 225, 240, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawRain(
  ctx: CanvasRenderingContext2D,
  drops: RainDrop[],
  splashes: RainSplash[],
  width: number,
  height: number,
  windRad: number,
  theme: WeatherTheme,
  dtScale = 1,
  cardTopY?: number,
) {
  const storm = theme === "thunder";
  // Collinear wind streak kinematics (guarded against NaN)
  const safeWindRad = Number.isFinite(windRad) ? windRad : 0;
  const windTilt = -Math.sin(safeWindRad);
  const slantRatio = windTilt * 0.38;
  const horizontalLead = height * Math.abs(slantRatio) + 60;

  ctx.save();
  ctx.lineCap = "round";
  for (const drop of drops) {
    const depthFactor = drop.layer === 2 ? 1.25 : drop.layer === 1 ? 0.95 : 0.65;
    const vy = drop.speed * depthFactor * dtScale;
    const vx = vy * slantRatio * (0.85 + drop.layer * 0.15);

    // Streak vector is strictly collinear with velocity vector (vx, vy)
    const streakDy = drop.length * depthFactor;
    const streakDx = streakDy * slantRatio * (0.85 + drop.layer * 0.15);

    const alpha = Math.min(1, drop.opacity * (storm ? 1.15 : 1) * (0.6 + drop.layer * 0.2));
    ctx.strokeStyle = storm
      ? `rgba(145, 185, 235, ${alpha})`
      : `rgba(90, 200, 250, ${alpha})`;
    ctx.lineWidth = drop.layer === 2 ? 1.45 : drop.layer === 1 ? 1.0 : 0.65;

    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + streakDx, drop.y + streakDy);
    ctx.stroke();

    drop.x += vx;
    drop.y += vy;

    // Card-top collision & splash emitter for foreground drops (strictly capped at 48)
    if (
      cardTopY !== undefined &&
      drop.layer === 2 &&
      drop.y + streakDy >= cardTopY &&
      drop.y < cardTopY + 20 &&
      drop.x > width * 0.05 &&
      drop.x < width * 0.95 &&
      Math.random() < 0.35
    ) {
      for (let s = 0; s < 2; s += 1) {
        if (splashes.length >= 48) break;
        splashes.push({
          x: drop.x + streakDx,
          y: cardTopY,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -(1.2 + Math.random() * 1.8),
          radius: 0.9 + Math.random() * 0.7,
          alpha: 0.75,
        });
      }
      drop.y = -streakDy - Math.random() * 30;
      drop.x = -horizontalLead * 0.2 + Math.random() * (width + horizontalLead * 1.2);
      continue;
    }

    if (
      drop.y > height + 25 ||
      (slantRatio < 0
        ? drop.x < -horizontalLead - 40
        : drop.x > width + horizontalLead + 40)
    ) {
      drop.y = -streakDy - Math.random() * 25;
      drop.x = -horizontalLead * 0.2 + Math.random() * (width + horizontalLead * 1.2);
    }
  }

  // Render and advance card-top splash micro-droplets
  for (let i = splashes.length - 1; i >= 0; i -= 1) {
    const sp = splashes[i];
    if (!sp) {
      splashes.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(175, 225, 255, ${Math.max(0, sp.alpha)})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, Math.max(0.1, sp.radius), 0, Math.PI * 2);
    ctx.fill();

    sp.x += sp.vx * dtScale;
    sp.y += sp.vy * dtScale;
    sp.vy += 0.18 * dtScale;
    sp.alpha -= 0.045 * dtScale;
    if (sp.alpha <= 0 || !Number.isFinite(sp.alpha)) {
      splashes.splice(i, 1);
    }
  }

  ctx.restore();
}

export function drawLightning(ctx: CanvasRenderingContext2D, bolt: LightningBolt, flashAlpha: number) {
  if (flashAlpha > 0) {
    ctx.save();
    // 1. Full-screen ambient discharge flash
    ctx.fillStyle = `rgba(200, 210, 255, ${flashAlpha * 0.36})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 2. Localized volumetric in-cloud illumination centered at bolt origin
    const cloudGlow = ctx.createRadialGradient(
      bolt.startX,
      ctx.canvas.height * 0.08,
      ctx.canvas.width * 0.02,
      bolt.startX,
      ctx.canvas.height * 0.12,
      ctx.canvas.width * 0.65,
    );
    cloudGlow.addColorStop(0, `rgba(235, 230, 255, ${flashAlpha * 0.55})`);
    cloudGlow.addColorStop(0.45, `rgba(190, 185, 245, ${flashAlpha * 0.24})`);
    cloudGlow.addColorStop(1, "rgba(150, 160, 220, 0)");
    ctx.fillStyle = cloudGlow;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  if (bolt.life <= 0) return;

  const progress = bolt.life / bolt.maxLife;
  // Stroboscopic double-strike envelope
  let strikeEnvelope = 1;
  if (progress < 0.2) {
    strikeEnvelope = progress / 0.2;
  } else if (progress < 0.35) {
    strikeEnvelope = 0.5 + (0.35 - progress) * 2;
  } else if (progress < 0.5) {
    strikeEnvelope = 0.85;
  } else {
    strikeEnvelope = Math.max(0, 1 - (progress - 0.5) / 0.5);
  }

  const allPolylines = [bolt.points, ...(bolt.branches || [])];

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Pass 1: Outer wide plasma sheath
  ctx.lineWidth = 12;
  ctx.strokeStyle = `rgba(160, 190, 255, ${strikeEnvelope * 0.24})`;
  ctx.lineCap = "round";
  ctx.lineJoin = "bevel";
  for (const line of allPolylines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i].x, line[i].y);
    ctx.stroke();
  }

  // Pass 2: Mid electric glow
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = `rgba(255, 235, 130, ${strikeEnvelope * 0.65})`;
  for (const line of allPolylines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i].x, line[i].y);
    ctx.stroke();
  }

  // Pass 3: Sharp white core (main trunk only)
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = `rgba(255, 255, 255, ${strikeEnvelope * 0.95})`;
  if (bolt.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i += 1) ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

export class WeatherSceneEngine {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private theme: WeatherTheme = "partly_cloudy";
  private isDay = true;
  private liteMode = false;
  private rainIntensity = 0;
  private windDegree = 90;
  private moonIllumination = 49;
  private moonPhase = "Last Quarter";
  private clouds: Cloud[] = [];
  private rain: RainDrop[] = [];
  private splashes: RainSplash[] = [];
  private stars: Star[] = [];
  private lightning: LightningBolt | null = null;
  private flashAlpha = 0;
  private nextLightningAt = 0;
  private cardTopY?: number;
  private raf = 0;
  private lastTime = 0;
  private running = false;
  private reducedMotion = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  setCardTop(cardTopY?: number) {
    this.cardTopY = cardTopY;
  }

  configure(config: SceneConfig) {
    this.theme = config.theme;
    this.isDay = config.isDay ?? true;
    this.liteMode = config.liteMode ?? false;
    this.rainIntensity = Number.isFinite(config.rainIntensity) ? Math.max(0, config.rainIntensity!) : 0;
    this.windDegree = Number.isFinite(config.windDegree) ? config.windDegree! : 90;
    this.moonIllumination = config.moonIllumination ?? 49;
    this.moonPhase = config.moonPhase ?? "Last Quarter";
    this.cardTopY = config.cardTopY;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.rebuildScene();

    if (this.liteMode || this.reducedMotion) {
      this.stop();
      this.renderFrame();
    } else {
      if (this.running) {
        cancelAnimationFrame(this.raf);
        this.running = false;
      }
      this.start();
      if (!this.running) {
        this.renderFrame();
      }
    }
  }

  resize(width: number, height: number, dpr: number) {
    const safeWidth = Math.max(0, Number.isFinite(width) ? Math.floor(width) : 0);
    const safeHeight = Math.max(0, Number.isFinite(height) ? Math.floor(height) : 0);
    const safeDpr = Math.max(1, Number.isFinite(dpr) ? dpr : 1);

    this.width = safeWidth;
    this.height = safeHeight;
    this.dpr = safeDpr;
    this.canvas.width = Math.floor(safeWidth * safeDpr);
    this.canvas.height = Math.floor(safeHeight * safeDpr);
    this.canvas.style.width = `${safeWidth}px`;
    this.canvas.style.height = `${safeHeight}px`;

    if (safeWidth <= 0 || safeHeight <= 0) {
      return;
    }

    this.ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    clearCloudSpriteCache();
    this.rebuildScene();

    if (!this.running || this.liteMode || this.reducedMotion) {
      this.renderFrame();
    }
  }

  private rebuildScene() {
    if (this.width <= 0 || this.height <= 0) return;
    const sceneTheme = sceneThemeFor(this.theme, this.isDay);
    const cloudTheme = this.theme === "fog" ? "fog" : sceneTheme;
    this.clouds = buildClouds(cloudTheme, this.width, this.height);
    this.stars = buildStars(this.width, this.height, 36);
    const rainThemes = this.theme === "rain" || this.theme === "thunder";
    this.rain = rainThemes
      ? buildRain(this.width, this.height, this.rainIntensity + (this.theme === "thunder" ? 2 : 0))
      : [];
    this.splashes = [];
    this.nextLightningAt = performance.now() + randomBetween(1500, 3500);
  }

  renderFrame() {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  start() {
    if (this.running) return;
    if (this.liteMode || this.reducedMotion) {
      this.tick(performance.now());
      return;
    }

    this.running = true;
    this.lastTime = performance.now();

    const budget = new FrameBudget();
    const isRainy = () => this.theme === "rain" || this.theme === "thunder";
    let lastFrameTime = performance.now();
    const MIN_FRAME_INTERVAL_MS = 16.0;

    const loop = (time: number) => {
      if (!this.running) return;
      if (time - lastFrameTime < MIN_FRAME_INTERVAL_MS) {
        this.raf = requestAnimationFrame(loop);
        return;
      }
      lastFrameTime = time;
      this.tick(time);
      if (!isRainy() && budget.record(time)) {
        this.running = false;
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick(time: number) {
    if (this.width <= 0 || this.height <= 0) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.liteMode && !this.reducedMotion) {
      for (const cloud of this.clouds) {
        cloud.x += cloud.speed * delta;
        if (cloud.x > this.width + cloud.width * 0.2) {
          cloud.x = -cloud.width - randomBetween(40, 160);
        }
      }

      if (this.theme === "thunder") {
        if (!this.lightning && time >= this.nextLightningAt) {
          this.lightning = generateLightning(this.width, this.height);
          this.flashAlpha = 1;
          this.nextLightningAt = time + randomBetween(3000, 7000);
        }
        if (this.lightning) {
          this.lightning.life += delta;
          if (this.lightning.life >= this.lightning.maxLife) {
            this.lightning = null;
          }
        }
        this.flashAlpha = Math.max(0, this.flashAlpha - delta * 4);
      }
    }

    this.render(time, delta);
  }

  private render(time: number, delta = 0.016) {
    const { ctx, width, height, theme, isDay } = this;
    const skyTheme = sceneThemeFor(theme, isDay);
    ctx.clearRect(0, 0, width, height);
    drawSky(ctx, width, height, skyTheme, isDay);

    if (shouldDrawSun(theme, isDay)) {
      const strength = theme === "clear" ? 1 : theme === "partly_cloudy" ? 0.35 : 0.28;
      drawSun(ctx, width, height, strength, time);
    }

    if (shouldDrawNightSky(theme, isDay)) {
      drawStars(ctx, this.stars, height, time);
      drawMoon(ctx, width, height, this.moonIllumination, this.moonPhase);
    }

    if (!this.liteMode) {
      const sorted = [...this.clouds].sort((a, b) => a.layer - b.layer);
      for (const cloud of sorted) {
        drawCloud(ctx, cloud, skyTheme);
      }

      if (shouldDrawFogLayer(theme)) drawFog(ctx, width, height, time);

      if ((theme === "rain" || theme === "thunder") && this.rain.length > 0) {
        const dtScale = Math.min(Math.max(delta * 60, 0.4), 2.5);
        drawRain(
          ctx,
          this.rain,
          this.splashes,
          width,
          height,
          (this.windDegree * Math.PI) / 180,
          theme,
          dtScale,
          this.cardTopY,
        );
      }

      if (theme === "thunder" && this.lightning) {
        drawLightning(ctx, this.lightning, this.flashAlpha);
      }
    }
  }
}
