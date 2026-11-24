// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersLightweightScene } from "@/lib/device/scene-capability";

function setDevice({
  memory,
  cores,
  reducedMotion = false,
  saveData = false,
}: {
  memory?: number;
  cores?: number;
  reducedMotion?: boolean;
  saveData?: boolean;
}) {
  Object.defineProperty(navigator, "deviceMemory", { value: memory, configurable: true });
  Object.defineProperty(navigator, "hardwareConcurrency", { value: cores, configurable: true });
  Object.defineProperty(navigator, "connection", { value: { saveData }, configurable: true });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reducedMotion && query.includes("reduce"), media: query })),
  );
}

describe("prefersLightweightScene", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the animated scene on a capable phone", () => {
    setDevice({ memory: 8, cores: 8 });
    expect(prefersLightweightScene()).toBe(false);
  });

  it("uses the still scene on a 2 GB Android Go phone, even with 4 cores", () => {
    setDevice({ memory: 2, cores: 4 });
    expect(prefersLightweightScene()).toBe(true);
  });

  it("uses the still scene on a 1 GB phone", () => {
    setDevice({ memory: 1, cores: 4 });
    expect(prefersLightweightScene()).toBe(true);
  });

  it("uses the still scene on a phone with 2 or fewer cores", () => {
    setDevice({ memory: 4, cores: 2 });
    expect(prefersLightweightScene()).toBe(true);
  });

  it("respects reduced motion and data saver", () => {
    setDevice({ memory: 8, cores: 8, reducedMotion: true });
    expect(prefersLightweightScene()).toBe(true);
    setDevice({ memory: 8, cores: 8, saveData: true });
    expect(prefersLightweightScene()).toBe(true);
  });
});
