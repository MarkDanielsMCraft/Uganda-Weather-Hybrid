// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { WeatherSceneGlEngine } from "./weather-scene-gl-engine";

function createMockGLContext() {
  const gl = {
    enable: vi.fn(),
    blendFunc: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_p, name) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    drawArrays: vi.fn(),
    lineWidth: vi.fn(),
    COLOR_BUFFER_BIT: 16384,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    DYNAMIC_DRAW: 35048,
    TRIANGLE_STRIP: 5,
    LINES: 1,
    LINE_STRIP: 3,
    FLOAT: 5126,
    BLEND: 3042,
  } as unknown as WebGLRenderingContext;

  return gl;
}

describe("WeatherSceneGlEngine", () => {
  it("initializes WebGL programs and buffers cleanly", () => {
    const gl = createMockGLContext();
    const canvasMock = {
      getContext: vi.fn(() => gl),
      style: {},
      width: 400,
      height: 800,
    } as unknown as HTMLCanvasElement;

    const engine = new WeatherSceneGlEngine(canvasMock);
    expect(engine).toBeDefined();
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
  });

  it("handles resize with zero, negative dimensions, and valid dimensions safely", () => {
    const gl = createMockGLContext();
    const canvasMock = {
      getContext: vi.fn(() => gl),
      style: {},
      width: 400,
      height: 800,
    } as unknown as HTMLCanvasElement;

    const engine = new WeatherSceneGlEngine(canvasMock);

    // 1. Zero dimensions
    expect(() => engine.resize(0, 0, 1)).not.toThrow();
    expect(canvasMock.width).toBe(0);
    expect(canvasMock.height).toBe(0);

    // 2. Negative dimensions
    expect(() => engine.resize(-400, -800, 1)).not.toThrow();
    expect(canvasMock.width).toBe(0);
    expect(canvasMock.height).toBe(0);

    // 3. Normal dimensions
    expect(() => engine.resize(375, 812, 2)).not.toThrow();
    expect(canvasMock.width).toBe(750);
    expect(canvasMock.height).toBe(1624);
  });

  it("handles live toggling of liteMode, rainIntensity, wind angles, and theme", () => {
    const gl = createMockGLContext();
    const canvasMock = {
      getContext: vi.fn(() => gl),
      style: {},
      width: 400,
      height: 800,
    } as unknown as HTMLCanvasElement;

    const engine = new WeatherSceneGlEngine(canvasMock);
    engine.resize(400, 800, 1);
    engine.start();

    // 1. Live toggle to liteMode = true
    expect(() => {
      engine.configure({
        theme: "cloudy",
        isDay: true,
        liteMode: true,
      });
    }).not.toThrow();

    // 2. Live toggle to rain with NaN windDegree and intensity
    expect(() => {
      engine.configure({
        theme: "rain",
        isDay: false,
        liteMode: false,
        rainIntensity: 3,
        windDegree: NaN,
      });
    }).not.toThrow();

    // 3. Render frame under thunder
    expect(() => {
      engine.configure({
        theme: "thunder",
        isDay: true,
        liteMode: false,
        rainIntensity: 4,
        windDegree: 360,
      });
      engine.renderFrame();
    }).not.toThrow();

    engine.stop();
  });
});
