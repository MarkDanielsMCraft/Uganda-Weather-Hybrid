// @vitest-environment jsdom
import { render, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GeolocationBootstrap } from "./GeolocationBootstrap";
import { usePreferencesStore } from "@/stores/preferencesStore";

// Mock dependencies
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

describe("GeolocationBootstrap Lifecycle and Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({
      _hasHydrated: true,
      districtSlug: "kampala",
      activePlace: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT overwrite manual district selection when geolocation update fires", async () => {
    // User explicitly selects "gulu"
    usePreferencesStore.getState().selectDistrict("gulu");
    expect(usePreferencesStore.getState().districtSlug).toBe("gulu");
    expect(usePreferencesStore.getState().activePlace).toBeNull();

    // Mock standing permission as true
    const originalNavigator = globalThis.navigator;
    const watchPositionMock = vi.fn((success) => {
      // Immediately emit a GPS position in Kampala
      success({
        coords: {
          latitude: 0.3476,
          longitude: 32.5825,
        },
      });
      return 101;
    });

    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
        geolocation: {
          getCurrentPosition: vi.fn(),
          watchPosition: watchPositionMock,
          clearWatch: vi.fn(),
        },
      },
      configurable: true,
    });

    // Mount GeolocationBootstrap
    render(<GeolocationBootstrap />);

    await act(async () => {
      await Promise.resolve();
    });

    // District must remain "gulu" because activePlace was not GPS mode
    expect(usePreferencesStore.getState().districtSlug).toBe("gulu");
    expect(mockReplace).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("discards stale out-of-order reverse-geocode responses to prevent race condition", async () => {
    const { createGpsPlaceLocation } = await import("@/lib/places/district-from-place");
    const initialGps = createGpsPlaceLocation(0.3476, 32.5825);
    usePreferencesStore.getState().selectPlace(initialGps);

    type MockFetchResult = { ok: boolean; json: () => Promise<unknown> };
    let resolveFirstFetch: ((value: MockFetchResult) => void) | null = null;
    let resolveSecondFetch: ((value: MockFetchResult) => void) | null = null;

    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return new Promise((resolve) => {
          resolveFirstFetch = resolve;
        });
      } else {
        return new Promise((resolve) => {
          resolveSecondFetch = resolve;
        });
      }
    });

    let watchCallback: ((pos: { coords: { latitude: number; longitude: number } }) => void) | null = null;
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
        geolocation: {
          getCurrentPosition: vi.fn(),
          watchPosition: vi.fn((cb) => {
            watchCallback = cb;
            return 202;
          }),
          clearWatch: vi.fn(),
        },
      },
      configurable: true,
    });

    render(<GeolocationBootstrap />);

    await vi.waitFor(() => {
      expect(watchCallback).not.toBeNull();
    });

    // Update 1: Position A (lat 0.36, lon 32.58) > 2km from Kampala
    await act(async () => {
      watchCallback!({
        coords: { latitude: 0.368, longitude: 32.5825 },
      });
    });

    // Update 2: Position B (lat 0.40, lon 32.58) > 2km from Position A
    await act(async () => {
      watchCallback!({
        coords: { latitude: 0.41, longitude: 32.5825 },
      });
    });

    // Resolve Update 2 FIRST (fast network)
    const placeB = {
      data: {
        place: {
          key: "gps-0_410-32_583",
          name: "Second Position",
          label: "Near Kampala",
          lat: 0.41,
          lon: 32.5825,
          parentDistrictSlug: "wakiso",
          region: "central",
        },
      },
    };

    await act(async () => {
      resolveSecondFetch!({
        ok: true,
        json: async () => placeB,
      });
    });

    expect(usePreferencesStore.getState().activePlace?.name).toBe("Second Position");

    // Resolve Update 1 SECOND (slow network)
    const placeA = {
      data: {
        place: {
          key: "gps-0_368-32_583",
          name: "First Position (Stale)",
          label: "Near Kampala",
          lat: 0.368,
          lon: 32.5825,
          parentDistrictSlug: "kampala",
          region: "central",
        },
      },
    };

    await act(async () => {
      resolveFirstFetch!({
        ok: true,
        json: async () => placeA,
      });
    });

    // Crucial assertion: Stale response must be discarded!
    // The active place must STILL be "Second Position", NOT overwritten by "First Position (Stale)"
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Second Position");

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("discards in-flight reverse-geocode when user executes manual district search in the meantime", async () => {
    const { createGpsPlaceLocation } = await import("@/lib/places/district-from-place");
    const initialGps = createGpsPlaceLocation(0.3476, 32.5825);
    usePreferencesStore.getState().selectPlace(initialGps);

    type MockFetchResult = { ok: boolean; json: () => Promise<unknown> };
    let resolvePendingFetch: ((value: MockFetchResult) => void) | null = null;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePendingFetch = resolve;
      });
    });

    let watchCallback: ((pos: { coords: { latitude: number; longitude: number } }) => void) | null = null;
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
        geolocation: {
          getCurrentPosition: vi.fn(),
          watchPosition: vi.fn((cb) => {
            watchCallback = cb;
            return 303;
          }),
          clearWatch: vi.fn(),
        },
      },
      configurable: true,
    });

    render(<GeolocationBootstrap />);

    await vi.waitFor(() => {
      expect(watchCallback).not.toBeNull();
    });

    // Movement > 2km fires update and triggers fetch
    await act(async () => {
      watchCallback!({
        coords: { latitude: 0.385, longitude: 32.5825 },
      });
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // User executes a manual search/selection for Jinja while fetch is in-flight
    act(() => {
      usePreferencesStore.getState().selectDistrict("jinja");
    });

    expect(usePreferencesStore.getState().districtSlug).toBe("jinja");
    expect(usePreferencesStore.getState().activePlace).toBeNull();

    // Now reverse geocode returns for the GPS position
    await act(async () => {
      resolvePendingFetch!({
        ok: true,
        json: async () => ({
          data: {
            place: {
              key: "gps-0_385-32_583",
              name: "Kawempe",
              label: "Near Kampala",
              lat: 0.385,
              lon: 32.5825,
              parentDistrictSlug: "kampala",
              region: "central",
            },
          },
        }),
      });
    });

    // The manual choice of "jinja" must NOT be overwritten!
    expect(usePreferencesStore.getState().districtSlug).toBe("jinja");
    expect(usePreferencesStore.getState().activePlace).toBeNull();

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("verifies battery optimization: geolocation calls strictly use enableHighAccuracy: false", async () => {
    let watchOptions: PositionOptions | undefined;
    let getOptions: PositionOptions | undefined;

    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
        geolocation: {
          getCurrentPosition: vi.fn((_success, _err, options) => {
            getOptions = options;
          }),
          watchPosition: vi.fn((_success, _err, options) => {
            watchOptions = options;
            return 404;
          }),
          clearWatch: vi.fn(),
        },
      },
      configurable: true,
    });

    render(<GeolocationBootstrap />);

    await vi.waitFor(() => {
      expect(watchOptions).toBeDefined();
    });

    // Verify low-power cellular/Wi-Fi positioning (enableHighAccuracy: false)
    expect(watchOptions).toBeDefined();
    expect(watchOptions?.enableHighAccuracy).toBe(false);
    expect(watchOptions?.maximumAge).toBeGreaterThanOrEqual(30000);

    expect(getOptions).toBeDefined();
    expect(getOptions?.enableHighAccuracy).toBe(false);

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });
});
