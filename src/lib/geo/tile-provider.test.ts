import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  baseTileCandidates,
  maptilerTileUrl,
  openstreetmapHotTileUrl,
  openstreetmapTileUrl,
  stadiaTileUrl,
} from "./tile-provider";

describe("tile-provider", () => {
  const originalEnv = process.env;
  const mockTile = { x: 151, y: 127, z: 8 };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("generates valid OpenStreetMap tile URLs without requiring API keys", () => {
    const url = openstreetmapTileUrl(mockTile);
    expect(url).toBe("https://tile.openstreetmap.org/8/151/127.png");
  });

  it("generates valid OpenStreetMap France HOT tile URLs", () => {
    const url = openstreetmapHotTileUrl(mockTile);
    expect(url).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.fr\/hot\/8\/151\/127\.png$/);
  });

  it("returns null for MapTiler and Stadia when environment keys are absent", () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    delete process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY;

    expect(maptilerTileUrl(mockTile)).toBeNull();
    expect(stadiaTileUrl(mockTile)).toBeNull();
  });

  it("includes OpenStreetMap and HOT as baseline candidates when keys are absent", () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    delete process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY;

    const candidates = baseTileCandidates(mockTile);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toBe("https://tile.openstreetmap.org/8/151/127.png");
    expect(candidates[1]).toMatch(/tile\.openstreetmap\.fr\/hot/);
  });

  it("prioritizes MapTiler when API key is provided", () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-maptiler-key";
    delete process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY;

    const candidates = baseTileCandidates(mockTile);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toContain("api.maptiler.com/maps/openstreetmap/8/151/127.png");
    expect(candidates[0]).toContain("key=test-maptiler-key");
    expect(candidates[1]).toBe("https://tile.openstreetmap.org/8/151/127.png");
  });

  it("includes Stadia Maps OSM Bright in candidate order when configured", () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-maptiler";
    process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY = "test-stadia";

    const candidates = baseTileCandidates(mockTile);
    expect(candidates).toHaveLength(4);
    expect(candidates[0]).toContain("api.maptiler.com");
    expect(candidates[1]).toContain("tiles.stadiamaps.com/tiles/osm_bright");
    expect(candidates[2]).toBe("https://tile.openstreetmap.org/8/151/127.png");
  });
});

