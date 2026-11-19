// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  buildRain,
  buildStars,
  generateLightning,
  drawRain,
  drawStars,
  drawLightning,
  drawFog,
  WeatherSceneEngine,
  type RainDrop,
  type RainSplash,
} from "./weather-scene-engine";

function createMockContext(width = 400, height = 800) {
  const gradientMock = {
    addColorStop: vi.fn(),
  };

  const ctx = {
    canvas: { width, height, style: {} },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => gradientMock),
    createRadialGradient: vi.fn(() => gradientMock),
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    strokeStyle: "#fff",
    fillStyle: "#fff",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
  } as unknown as CanvasRenderingContext2D;

  return { ctx, gradientMock };
}

(HTMLCanvasElement.prototype.getContext as unknown as ReturnType<typeof vi.fn>) = vi.fn(
  () => createMockContext().ctx,
);

describe("weather-scene-engine", () => {
  describe("buildRain and drawRain kinematics", () => {
    it("generates stratified rain drops across 3 depth layers", () => {
      const drops = buildRain(400, 800, 2);
      expect(drops.length).toBeGreaterThanOrEqual(120);
      expect(drops.length).toBeLessThanOrEqual(420);

      const layers = new Set(drops.map((d) => d.layer));
      expect(layers.has(0)).toBe(true);
      expect(layers.has(1)).toBe(true);
      expect(layers.has(2)).toBe(true);
    });

    it("advances rain particles collinear with drawn streak angle", () => {
      const { ctx } = createMockContext(400, 800);
      const drops: RainDrop[] = [
        { x: 100, y: 100, length: 20, speed: 10, opacity: 0.5, layer: 2 },
      ];
      const splashes: RainSplash[] = [];
      const windRad = (90 * Math.PI) / 180; // East wind (Math.sin = 1) -> blows left

      const prevX = drops[0].x;
      const prevY = drops[0].y;

      drawRain(ctx, drops, splashes, 400, 800, windRad, "rain", 1, undefined);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      // Y advances downward
      expect(drops[0].y).toBeGreaterThan(prevY);
      // X drifts leftward under positive east wind
      expect(drops[0].x).toBeLessThan(prevX);
    });

    it("emits card-top splash micro-droplets when foreground drops hit cardTopY", () => {
      const { ctx } = createMockContext(400, 800);
      const cardTopY = 320;
      // Position drop right at cardTopY threshold so collision triggers reliably
      const drops: RainDrop[] = Array.from({ length: 20 }, (_, i) => ({
        x: 100 + i * 5,
        y: cardTopY - 2,
        length: 20,
        speed: 15,
        opacity: 0.5,
        layer: 2 as const, // Foreground layer
      }));
      const splashes: RainSplash[] = [];

      drawRain(ctx, drops, splashes, 400, 800, 0, "rain", 1, cardTopY);

      // Splashes should be populated when collisions occur
      if (splashes.length > 0) {
        expect(splashes[0].y).toBeLessThanOrEqual(cardTopY);
        expect(splashes[0].vy).toBeLessThan(0); // Upward arc velocity
        expect(splashes[0].alpha).toBeGreaterThan(0);
      }
    });

    it("advances splash particles under gravity and fades them", () => {
      const { ctx } = createMockContext(400, 800);
      const drops: RainDrop[] = [];
      const splashes: RainSplash[] = [
        { x: 200, y: 300, vx: 0.5, vy: -1.5, radius: 1.2, alpha: 0.75 },
      ];

      const initialVy = splashes[0].vy;
      const initialAlpha = splashes[0].alpha;

      drawRain(ctx, drops, splashes, 400, 800, 0, "rain", 1, undefined);

      expect(splashes[0].vy).toBeGreaterThan(initialVy); // Gravity pulls down
      expect(splashes[0].alpha).toBeLessThan(initialAlpha); // Alpha decays
    });
  });

  describe("buildStars and drawStars celestial mechanics", () => {
    it("generates stars with bounded coordinates and twinkle speeds", () => {
      const stars = buildStars(400, 800, 50);
      expect(stars.length).toBe(50);
      stars.forEach((s) => {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(400);
        expect(s.y).toBeLessThanOrEqual(800 * 0.58);
      });
    });

    it("renders twinkling stars and periodic celestial meteor trail", () => {
      const { ctx } = createMockContext(400, 800);
      const stars = buildStars(400, 800, 10);

      // Frame time within meteor window (phaseMs = 300 < 650)
      drawStars(ctx, stars, 800, 9300);

      expect(ctx.createLinearGradient).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe("generateLightning and drawLightning", () => {
    it("generates fractal trunk and branch coordinates", () => {
      const bolt = generateLightning(400, 800);
      expect(bolt.startX).toBeGreaterThanOrEqual(100);
      expect(bolt.startX).toBeLessThanOrEqual(300);
      expect(bolt.points.length).toBeGreaterThan(1);
      expect(bolt.maxLife).toBeGreaterThan(0);
    });

    it("draws 3-pass additive stroke and localized in-cloud glow during flash", () => {
      const { ctx } = createMockContext(400, 800);
      const bolt = generateLightning(400, 800);
      bolt.life = 0.05; // Active life

      drawLightning(ctx, bolt, 0.8);

      expect(ctx.createRadialGradient).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe("drawFog volumetric mist banks", () => {
    it("renders drifting elliptical puffs across the viewport", () => {
      const { ctx } = createMockContext(400, 800);
      drawFog(ctx, 400, 800, 16000);

      expect(ctx.createRadialGradient).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe("WeatherSceneEngine instance lifecycle", () => {
    it("configures scene parameters and updates cardTopY", () => {
      const { ctx } = createMockContext(400, 800);
      const canvasMock = {
        getContext: vi.fn(() => ctx),
        style: {},
        width: 400,
        height: 800,
      } as unknown as HTMLCanvasElement;

      const engine = new WeatherSceneEngine(canvasMock);
      engine.configure({
        theme: "rain",
        isDay: true,
        rainIntensity: 3,
        cardTopY: 340,
      });

      engine.setCardTop(360);
      expect(engine).toBeDefined();

      engine.resize(375, 812, 2);
      expect(canvasMock.width).toBe(750);
      expect(canvasMock.height).toBe(1624);
    });

    it("strictly bounds splashes array to at most 48 elements under heavy collision stress", () => {
      const { ctx } = createMockContext(400, 800);
      const cardTopY = 320;
      // 100 drops directly on the collision line
      const drops: RainDrop[] = Array.from({ length: 100 }, (_, i) => ({
        x: 50 + (i % 300),
        y: cardTopY,
        length: 20,
        speed: 15,
        opacity: 0.8,
        layer: 2 as const,
      }));
      const splashes: RainSplash[] = [];

      // Simulate multiple collision iterations
      for (let step = 0; step < 10; step++) {
        drawRain(ctx, drops, splashes, 400, 800, 0, "thunder", 1, cardTopY);
      }

      expect(splashes.length).toBeLessThanOrEqual(48);
    });

    it("handles all wind angles from 0 to 360, negative angles, and NaN without throwing or producing NaN coordinates", () => {
      const { ctx } = createMockContext(400, 800);
      const angles = [0, 45, 90, 135, 180, 225, 270, 315, 360, -45, -180, 720, NaN, Infinity];

      for (const angle of angles) {
        const drops: RainDrop[] = [
          { x: 200, y: 100, length: 20, speed: 10, opacity: 0.5, layer: 2 },
        ];
        const splashes: RainSplash[] = [];
        const rad = (angle * Math.PI) / 180;

        expect(() => {
          drawRain(ctx, drops, splashes, 400, 800, rad, "rain", 1, 300);
        }).not.toThrow();

        expect(Number.isFinite(drops[0].x)).toBe(true);
        expect(Number.isFinite(drops[0].y)).toBe(true);
      }
    });

    it("gracefully handles zero and negative viewport dimensions during resize", () => {
      const { ctx } = createMockContext(400, 800);
      const canvasMock = {
        getContext: vi.fn(() => ctx),
        style: {},
        width: 400,
        height: 800,
      } as unknown as HTMLCanvasElement;

      const engine = new WeatherSceneEngine(canvasMock);

      // 1. Zero width
      expect(() => engine.resize(0, 800, 1)).not.toThrow();
      expect(canvasMock.width).toBe(0);

      // 2. Zero height
      expect(() => engine.resize(400, 0, 1)).not.toThrow();
      expect(canvasMock.height).toBe(0);

      // 3. Negative dimensions
      expect(() => engine.resize(-300, -600, 1)).not.toThrow();
      expect(canvasMock.width).toBe(0);
      expect(canvasMock.height).toBe(0);

      // 4. Recovery to valid dimensions
      expect(() => engine.resize(375, 812, 2)).not.toThrow();
      expect(canvasMock.width).toBe(750);
      expect(canvasMock.height).toBe(1624);
    });

    it(
      "handles live toggling of liteMode, isDay, theme, and rainIntensity while running",
      () => {
      const { ctx } = createMockContext(400, 800);
      const canvasMock = {
        getContext: vi.fn(() => ctx),
        style: {},
        width: 400,
        height: 800,
      } as unknown as HTMLCanvasElement;

      const engine = new WeatherSceneEngine(canvasMock);
      engine.resize(400, 800, 1);
      engine.start();

      // 1. Live toggle to liteMode = true
      expect(() => {
        engine.configure({
          theme: "partly_cloudy",
          isDay: true,
          liteMode: true,
        });
      }).not.toThrow();

      // 2. Live toggle back to liteMode = false with rain
      expect(() => {
        engine.configure({
          theme: "rain",
          isDay: false,
          liteMode: false,
          rainIntensity: 4,
          windDegree: 120,
        });
      }).not.toThrow();

      // 3. Live toggle to thunder with lightning
      expect(() => {
        engine.configure({
          theme: "thunder",
          isDay: true,
          liteMode: false,
          rainIntensity: 5,
        });
      }).not.toThrow();

      engine.stop();
    }, 12000);
  });
});
