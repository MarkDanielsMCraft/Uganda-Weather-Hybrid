import type { WeatherTheme } from "@/types/weather";
import {
  ATMOSPHERE_FRAGMENT,
  ATMOSPHERE_VERTEX,
  LIGHTNING_FRAGMENT,
  LIGHTNING_VERTEX,
  RAIN_FRAGMENT,
  RAIN_VERTEX,
} from "./gl/atmosphere-shaders";
import { createFullscreenQuad, createProgram } from "./gl/webgl-utils";
import type { SceneConfig } from "./weather-scene-engine";
import { moonPhaseForShader } from "@/lib/weather/moon-render";
import { FrameBudget } from "./frame-budget";
import { sceneThemeFor } from "@/lib/weather/conditions";
import { getEquatorialSunPosition } from "@/lib/weather/solar-ephemeris";

const THEME_INDEX: Record<WeatherTheme, number> = {
  clear: 0,
  partly_cloudy: 1,
  cloudy: 2,
  rain: 3,
  thunder: 4,
  fog: 5,
  night: 6,
};

const CLOUD_COVER: Record<WeatherTheme, number> = {
  clear: 0.06,
  partly_cloudy: 0.42,
  cloudy: 0.82,
  rain: 0.78,
  thunder: 0.85,
  fog: 0.35,
  night: 0.28,
};

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

interface LightningBolt {
  points: Float32Array;
  pointCount: number;
  life: number;
  maxLife: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildRain(width: number, height: number, intensity: number, windDegree = 90): RainDrop[] {
  const safeWindDegree = Number.isFinite(windDegree) ? windDegree : 90;
  const windRad = (safeWindDegree * Math.PI) / 180;
  const slantRatio = -Math.sin(windRad) * 0.35;
  const horizontalLead = height * Math.abs(slantRatio) + 60;
  const count = Math.min(600, Math.round(180 + intensity * 45));
  const drops: RainDrop[] = [];
  for (let i = 0; i < count; i += 1) {
    const layer = i % 3;
    drops.push({
      x: -horizontalLead * 0.2 + Math.random() * (width + horizontalLead * 1.2),
      y: Math.random() * height,
      length: layer === 2 ? randomBetween(16, 30) : layer === 1 ? randomBetween(11, 20) : randomBetween(7, 14),
      speed: layer === 2 ? randomBetween(16, 26) : layer === 1 ? randomBetween(10, 16) : randomBetween(6, 10),
      opacity: layer === 2 ? randomBetween(0.28, 0.5) : layer === 1 ? randomBetween(0.16, 0.32) : randomBetween(0.06, 0.14),
    });
  }
  return drops;
}

function generateLightning(width: number, height: number): LightningBolt {
  const points: number[] = [];
  let x = randomBetween(width * 0.2, width * 0.8);
  let y = 0;
  const targetY = randomBetween(height * 0.3, height * 0.58);
  points.push(x, y);

  while (y < targetY) {
    x += randomBetween(-32, 32);
    y += randomBetween(20, 44);
    points.push(x, y);
    if (Math.random() < 0.22 && points.length < 24) {
      let bx = x;
      let by = y;
      for (let b = 0; b < 3; b += 1) {
        bx += randomBetween(12, 36);
        by += randomBetween(8, 24);
        points.push(bx, by);
        points.push(x, y);
      }
    }
  }

  return {
    points: new Float32Array(points),
    pointCount: points.length / 2,
    life: 0,
    maxLife: 0.24,
  };
}

export class WeatherSceneGlEngine {
  private gl: WebGLRenderingContext;
  private atmosphereProgram: WebGLProgram;
  private rainProgram: WebGLProgram;
  private lightningProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private rainBuffer: WebGLBuffer;
  private lightningBuffer: WebGLBuffer;

  private width = 0;
  private height = 0;
  private theme: WeatherTheme = "partly_cloudy";
  private isDay = true;
  private liteMode = false;
  private rainIntensity = 0;
  private windDegree = 90;
  private moonIllumination = 49;
  private moonPhase = "Last Quarter";

  private rain: RainDrop[] = [];
  private rainLineData = new Float32Array(0);
  private lightning: LightningBolt | null = null;
  private flashAlpha = 0;
  private nextLightningAt = 0;
  private cardTopY?: number;

  private raf = 0;
  private lastTime = 0;
  private running = false;
  private reducedMotion = false;

  private uniforms = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL not supported");

    this.gl = gl;
    this.atmosphereProgram = createProgram(gl, ATMOSPHERE_VERTEX, ATMOSPHERE_FRAGMENT);
    this.rainProgram = createProgram(gl, RAIN_VERTEX, RAIN_FRAGMENT);
    this.lightningProgram = createProgram(gl, LIGHTNING_VERTEX, LIGHTNING_FRAGMENT);
    this.quadBuffer = createFullscreenQuad(gl);
    this.rainBuffer = gl.createBuffer()!;
    this.lightningBuffer = gl.createBuffer()!;

    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  setCardTop(cardTopY?: number) {
    this.cardTopY = cardTopY;
  }

  configure(config: SceneConfig) {
    this.isDay = config.isDay ?? true;
    this.theme = sceneThemeFor(config.theme, this.isDay);
    this.liteMode = config.liteMode ?? false;
    this.rainIntensity = Number.isFinite(config.rainIntensity) ? Math.max(0, config.rainIntensity!) : 0;
    this.windDegree = Number.isFinite(config.windDegree) ? config.windDegree! : 90;
    this.moonIllumination = config.moonIllumination ?? 49;
    this.moonPhase = config.moonPhase ?? "Last Quarter";
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
    this.canvas.width = Math.floor(safeWidth * safeDpr);
    this.canvas.height = Math.floor(safeHeight * safeDpr);
    this.canvas.style.width = `${safeWidth}px`;
    this.canvas.style.height = `${safeHeight}px`;

    if (safeWidth <= 0 || safeHeight <= 0) {
      return;
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.rebuildScene();

    if (!this.running || this.liteMode || this.reducedMotion) {
      this.renderFrame();
    }
  }

  private rebuildScene() {
    if (this.width <= 0 || this.height <= 0) return;
    const rainy = this.theme === "rain" || this.theme === "thunder";
    this.rain = rainy
      ? buildRain(
          this.width,
          this.height,
          this.rainIntensity + (this.theme === "thunder" ? 2 : 0),
          this.windDegree,
        )
      : [];
    this.rainLineData = new Float32Array(this.rain.length * 4);
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
      // For rain and storm scenes, the drops must keep falling — do not freeze
      // rain streaks in mid-air. For non-rain scenes, respect the frame budget.
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
      const safeWindDegree = Number.isFinite(this.windDegree) ? this.windDegree : 90;
      const windRad = (safeWindDegree * Math.PI) / 180;
      const windTilt = -Math.sin(windRad);
      const slantRatio = windTilt * 0.35;
      const horizontalLead = this.height * Math.abs(slantRatio) + 60;
      const dtScale = Math.min(Math.max(delta * 60, 0.4), 2.5);
      let offset = 0;
      for (const drop of this.rain) {
        const vy = drop.speed * dtScale;
        const vx = vy * slantRatio;
        const streakDy = drop.length;
        const streakDx = streakDy * slantRatio;

        drop.y += vy;
        drop.x += vx;
        if (
          drop.y > this.height + 25 ||
          (slantRatio < 0
            ? drop.x < -horizontalLead - 40
            : drop.x > this.width + horizontalLead + 40)
        ) {
          drop.y = randomBetween(-40, -8);
          drop.x = -horizontalLead * 0.2 + Math.random() * (this.width + horizontalLead * 1.2);
        }
        this.rainLineData[offset++] = drop.x;
        this.rainLineData[offset++] = drop.y;
        this.rainLineData[offset++] = drop.x + streakDx;
        this.rainLineData[offset++] = drop.y + streakDy;
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
        this.flashAlpha = Math.max(0, this.flashAlpha - delta * 4.5);
      } else {
        this.flashAlpha = 0;
        this.lightning = null;
      }
    }

    this.render(time);
  }

  private render(time: number) {
    const { gl, theme } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawAtmosphere(time);
    if (!this.liteMode) {
      if (this.rain.length > 0) this.drawRain();
      if (theme === "thunder" && this.lightning) this.drawLightning();
    }
  }

  private drawAtmosphere(time: number) {
    const { gl, theme } = this;
    const program = this.atmosphereProgram;
    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const themeIndex = THEME_INDEX[theme];
    const showSun = theme === "clear" || theme === "partly_cloudy" || theme === "fog";
    const sunStrength =
      theme === "fog" ? 0.35 : theme === "clear" ? 1 : theme === "partly_cloudy" ? 0.85 : 0;

    this.setUniform(program, "u_resolution", [this.canvas.width, this.canvas.height]);
    this.setUniform(program, "u_time", time);
    this.setUniform(program, "u_theme", themeIndex);
    this.setUniform(program, "u_is_day", this.isDay ? 1.0 : 0.0);
    this.setUniform(program, "u_flash", this.flashAlpha);
    this.setUniform(program, "u_cloud_cover", CLOUD_COVER[theme]);
    this.setUniform(program, "u_haze", theme === "fog" ? 0.85 : theme === "rain" ? 0.35 : 0.1);
    // Equatorial solar ephemeris for Uganda (0° to 4°N)
    const ephemeris = getEquatorialSunPosition();
    this.setUniform(program, "u_sun_pos", [ephemeris.x, ephemeris.y]);
    this.setUniform(
      program,
      "u_sun_strength",
      showSun && ephemeris.isDaylight ? sunStrength * ephemeris.strength : 0,
    );
    this.setUniform(program, "u_moon_phase", moonPhaseForShader(this.moonIllumination, this.moonPhase));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawRain() {
    const { gl } = this;
    gl.useProgram(this.rainProgram);
    const posLoc = gl.getAttribLocation(this.rainProgram, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rainBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.rainLineData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    this.setUniform(this.rainProgram, "u_resolution", [this.width, this.height]);
    this.setUniform(this.rainProgram, "u_opacity", this.isDay ? 0.55 : 0.38);
    gl.drawArrays(gl.LINES, 0, this.rain.length * 2);
  }

  private drawLightning() {
    if (!this.lightning) return;
    const { gl } = this;
    const fade = 1 - this.lightning.life / this.lightning.maxLife;
    gl.useProgram(this.lightningProgram);
    const posLoc = gl.getAttribLocation(this.lightningProgram, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lightning.points, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    this.setUniform(this.lightningProgram, "u_resolution", [this.width, this.height]);
    this.setUniform(this.lightningProgram, "u_alpha", fade * 0.95);
    gl.lineWidth(2);
    gl.drawArrays(gl.LINE_STRIP, 0, this.lightning.pointCount);
  }

  private setUniform(program: WebGLProgram, name: string, value: number | number[]) {
    /**
     * Keyed by program object identity (WeakMap), not `${program}` string
     * interpolation — every WebGLProgram stringifies to the same literal
     * "[object WebGLProgram]", so a plain string-keyed cache silently
     * collided across atmosphere/rain/lightning programs whenever they
     * shared a uniform name (e.g. u_resolution), handing one program's
     * location to another and making the GL driver reject the call.
     */
    let programCache = this.uniforms.get(program);
    if (!programCache) {
      programCache = new Map();
      this.uniforms.set(program, programCache);
    }
    if (!programCache.has(name)) {
      programCache.set(name, this.gl.getUniformLocation(program, name));
    }
    const loc = programCache.get(name);
    if (!loc) return;
    if (typeof value === "number") {
      this.gl.uniform1f(loc, value);
    } else if (value.length === 2) {
      this.gl.uniform2f(loc, value[0], value[1]);
    }
  }
}
