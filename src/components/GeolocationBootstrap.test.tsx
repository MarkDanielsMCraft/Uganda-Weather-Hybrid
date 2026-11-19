import { describe, expect, it, vi } from "vitest";
import { haversineKm, MIN_MOVE_KM, hasStandingLocationPermission } from "./GeolocationBootstrap";

describe("GeolocationBootstrap helpers", () => {
  it("calculates haversine distance correctly between coordinates", () => {
    // Kampala to Entebbe is approx 33 to 35 km
    const kampala = { lat: 0.3476, lon: 32.5825 };
    const entebbe = { lat: 0.0512, lon: 32.4637 };
    const dist = haversineKm(kampala, entebbe);

    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(40);
  });

  it("calculates 0 km for identical coordinates", () => {
    const pt = { lat: 0.3476, lon: 32.5825 };
    expect(haversineKm(pt, pt)).toBe(0);
  });

  it("sets MIN_MOVE_KM to 2 km for responsive inter-district movement", () => {
    expect(MIN_MOVE_KM).toBe(2);
  });

  it("detects standing location permission accurately", async () => {
    const originalNavigator = globalThis.navigator;
    const queryMock = vi.fn().mockResolvedValue({ state: "granted" });
    Object.defineProperty(globalThis, "navigator", {
      value: { permissions: { query: queryMock } },
      configurable: true,
    });

    const granted = await hasStandingLocationPermission();
    expect(granted).toBe(true);
    expect(queryMock).toHaveBeenCalledWith({ name: "geolocation" });

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("rejects points outside the Uganda bounding box", async () => {
    const { isWithinUganda } = await import("@/lib/places/uganda-bounds");
    expect(isWithinUganda(0.3476, 32.5825)).toBe(true); // Kampala
    expect(isWithinUganda(-4.1, 32.5825)).toBe(false); // South of minLat
    expect(isWithinUganda(5.1, 32.5825)).toBe(false); // North of maxLat
    expect(isWithinUganda(0.3476, 28.9)).toBe(false); // West of minLon
    expect(isWithinUganda(0.3476, 36.1)).toBe(false); // East of maxLon
    expect(isWithinUganda(NaN, 32.5825)).toBe(false);
    expect(isWithinUganda(0.3476, Infinity)).toBe(false);
  });

  it("handles movement threshold boundary values correctly", () => {
    const start = { lat: 0.3476, lon: 32.5825 };
    // 1 km north is approx 0.009 degrees lat
    const moved1Km = { lat: 0.3476 + 0.009, lon: 32.5825 };
    const dist1Km = haversineKm(start, moved1Km);
    expect(dist1Km).toBeLessThan(MIN_MOVE_KM);

    // 2.5 km north is approx 0.0225 degrees lat
    const moved2_5Km = { lat: 0.3476 + 0.0225, lon: 32.5825 };
    const dist2_5Km = haversineKm(start, moved2_5Km);
    expect(dist2_5Km).toBeGreaterThan(MIN_MOVE_KM);
  });

  it("handles AbortSignal cleanly in resolvePlaceFromCoords without uncaught errors", async () => {
    const { resolvePlaceFromCoords } = await import("./GeolocationBootstrap");
    const controller = new AbortController();
    controller.abort();
    const result = await resolvePlaceFromCoords(0.3476, 32.5825, controller.signal);
    expect(result).toBeNull();
  });

  it("preserves manual district selection when not in GPS tracking mode", async () => {
    const { usePreferencesStore } = await import("@/stores/preferencesStore");
    // Simulate user explicitly selecting a district (e.g. Jinja)
    usePreferencesStore.getState().selectDistrict("jinja");
    const state = usePreferencesStore.getState();

    expect(state.districtSlug).toBe("jinja");
    expect(state.activePlace).toBeNull();
    // Verify that activePlace is not a GPS tracking key
    expect(Boolean(state.activePlace?.key?.startsWith("gps-"))).toBe(false);
  });

  it("identifies active GPS tracking mode when user selects GPS location", async () => {
    const { usePreferencesStore } = await import("@/stores/preferencesStore");
    const { createGpsPlaceLocation } = await import("@/lib/places/district-from-place");

    const gpsPlace = createGpsPlaceLocation(0.3476, 32.5825);
    usePreferencesStore.getState().selectPlace(gpsPlace);
    const state = usePreferencesStore.getState();

    expect(state.activePlace).not.toBeNull();
    expect(state.activePlace?.key?.startsWith("gps-")).toBe(true);
  });
});

