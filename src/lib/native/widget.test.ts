// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractWidgetData, getStoredWidgetData, isSampleWeather, syncWidgetData } from "./widget";
import type { WeatherBundle } from "@/types/weather";

const pluginUpdateMock = vi.hoisted(() =>
  vi.fn<(options: { json: string }) => Promise<void>>(async () => undefined),
);

// Only registerPlugin is replaced so the native WidgetData plugin can be observed;
// the real Capacitor object is kept for the platform checks the other tests spy on.
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => ({ update: pluginUpdateMock }),
  };
});

const mockBundle: WeatherBundle = {
  district: {
    id: "kampala",
    name: "Kampala",
    slug: "kampala",
    region: "central",
    coordinates: { lat: 0.3476, lon: 32.5825 },
    population: 1680600,
    rainfallPattern: "bimodal",
    hazards: ["flash_floods"],
  },
  isDay: true,
  temperature: {
    celsius: 24.3,
    feelsLike: 25.1,
  },
  condition: {
    code: 1000,
    text: "Partly Cloudy",
    icon: "//cdn.weatherapi.com/weather/64x64/day/116.png",
    theme: "cloudy",
  },
  wind: {
    speedKph: 12,
    gustKph: 18,
    direction: "SE",
    degree: 135,
  },
  humidity: 68,
  uvIndex: 6,
  visibilityKm: 10,
  pressureMb: 1014,
  precipitation: {
    mm: 1.2,
    chance: 45,
  },
  daily: {
    high: 28.4,
    low: 18.7,
  },
  hourly: [],
  dailyForecast: [],
  astronomy: {
    sunrise: "06:45",
    sunset: "18:52",
    moonPhase: "Waxing Gibbous",
    moonIllumination: 78,
  },
  airQuality: {
    aqi: 42,
    category: "Good",
    advice: "Air quality is good.",
    pm25: 10.2,
  },
  alerts: [
    {
      id: "alert-1",
      title: "Heavy Rain Watch",
      description: "Expect persistent rainfall during afternoon hours.",
      severity: "watch",
      source: "UNMA",
      issuedAt: "2026-10-12T12:00:00Z",
      expiresAt: "2026-10-12T18:00:00Z",
    },
  ],
  updatedAt: "2026-10-12T14:30:00Z",
  source: "WeatherAPI",
  stale: false,
};

describe("widget data bridge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("extracts widget data correctly with rounded numbers and alert", () => {
    const data = extractWidgetData(mockBundle);
    expect(data.districtName).toBe("Kampala");
    expect(data.districtSlug).toBe("kampala");
    expect(data.temperatureC).toBe(24);
    expect(data.feelsLikeC).toBe(25);
    expect(data.highC).toBe(28);
    expect(data.lowC).toBe(19);
    expect(data.precipitationChance).toBe(45);
    expect(data.windSpeedKph).toBe(12);
    expect(data.uvIndex).toBe(6);
    expect(data.humidity).toBe(68);
    expect(data.sunriseText).toBe("06:45");
    expect(data.sunsetText).toBe("18:52");
    expect(data.hasActiveAlert).toBe(true);
    expect(data.alertTitle).toBe("Heavy Rain Watch");
    expect(data.aqi).toBe(42);
    expect(data.aqiCategory).toBe("Good");
    expect(data.agroSeason).toBe("bimodal");
    expect(data.isLakeZone).toBe(false);
    expect(Array.isArray(data.hourlyTimeline)).toBe(true);
  });

  it("extracts 12-hour predictive timeline batch from hourly forecast", () => {
    const bundleWithHours: WeatherBundle = {
      ...mockBundle,
      hourly: Array.from({ length: 16 }, (_, i) => ({
        time: `2026-10-12T${String(i).padStart(2, "0")}:00:00Z`,
        label: `${i}:00`,
        temp: 20 + (i % 5),
        icon: "https://cdn.weatherapi.com/icon.png",
        theme: "clear" as const,
        isDay: true,
        kind: "hour" as const,
        rainChance: i * 5,
      })),
    };

    const data = extractWidgetData(bundleWithHours);
    expect(data.hourlyTimeline).toHaveLength(12);
    expect(data.hourlyTimeline?.[0]).toEqual({
      time: "2026-10-12T00:00:00Z",
      label: "0:00",
      tempC: 20,
      conditionTheme: "clear",
      rainChance: 0,
      kind: "hour",
    });
  });

  it("leaves sunrise and sunset markers out of hourly widget forecasts", () => {
    const bundleWithSolarMarkers: WeatherBundle = {
      ...mockBundle,
      hourly: [
        {
          time: "2026-10-12T06:00:00Z",
          label: "Sunrise",
          temp: 19,
          icon: "",
          theme: "clear",
          isDay: true,
          kind: "sunrise",
        },
        {
          time: "2026-10-12T07:00:00Z",
          label: "7:00 am",
          temp: 20,
          icon: "",
          theme: "clear",
          isDay: true,
          kind: "hour",
        },
        {
          time: "2026-10-12T18:00:00Z",
          label: "Sunset",
          temp: 25,
          icon: "",
          theme: "clear",
          isDay: true,
          kind: "sunset",
        },
      ],
    };

    expect(extractWidgetData(bundleWithSolarMarkers).hourlyTimeline).toEqual([
      {
        time: "2026-10-12T07:00:00Z",
        label: "7:00 am",
        tempC: 20,
        conditionTheme: "clear",
        rainChance: null,
        kind: "hour",
      },
    ]);
  });

  it("syncs and retrieves widget data from storage", async () => {
    const data = await syncWidgetData(mockBundle);
    expect(data).not.toBeNull();
    const stored = getStoredWidgetData();
    expect(stored).not.toBeNull();
    expect(stored?.districtName).toBe("Kampala");
    expect(stored?.temperatureC).toBe(24);
  });

  it("relays widget data to Android WidgetBridge when native bridge is present", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    const updateWidgetDataMock = vi.fn();
    (window as unknown as { WidgetBridge?: { updateWidgetData: (json: string) => void } }).WidgetBridge = {
      updateWidgetData: updateWidgetDataMock,
    };

    try {
      await syncWidgetData(mockBundle);
      expect(updateWidgetDataMock).toHaveBeenCalledTimes(1);
      const passedJson = JSON.parse(updateWidgetDataMock.mock.calls[0][0]);
      expect(passedJson.districtName).toBe("Kampala");
      expect(passedJson.temperatureC).toBe(24);
    } finally {
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      nativePlatformSpy.mockRestore();
    }
  });

  it("relays widget data to WebKit messageHandler when present", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    const postMessageMock = vi.fn();
    (window as unknown as { webkit?: { messageHandlers?: { widgetUpdate?: { postMessage: (msg: string) => void } } } }).webkit = {
      messageHandlers: {
        widgetUpdate: {
          postMessage: postMessageMock,
        },
      },
    };

    try {
      await syncWidgetData(mockBundle);
      expect(postMessageMock).toHaveBeenCalledTimes(1);
      const passedJson = JSON.parse(postMessageMock.mock.calls[0][0]);
      expect(passedJson.districtName).toBe("Kampala");
      expect(passedJson.temperatureC).toBe(24);
    } finally {
      delete (window as unknown as { webkit?: unknown }).webkit;
      nativePlatformSpy.mockRestore();
    }
  });

  it("handles malformed JSON or corrupted types in localStorage without throwing", () => {
    // 1. SyntaxError in JSON
    localStorage.setItem("uw:widget:data", "{not-valid-json: true,");
    expect(getStoredWidgetData()).toBeNull();

    // 2. Primitive JSON (number, boolean)
    localStorage.setItem("uw:widget:data", "12345");
    expect(getStoredWidgetData()).toBeNull();

    // 3. Array instead of object
    localStorage.setItem("uw:widget:data", "[]");
    expect(getStoredWidgetData()).toBeNull();

    // 4. Incomplete object lacking required district properties
    localStorage.setItem("uw:widget:data", JSON.stringify({ invalid: true }));
    expect(getStoredWidgetData()).toBeNull();
  });

  it("ignores widget data written with the previous schema", () => {
    localStorage.setItem(
      "uw:widget:data",
      JSON.stringify({ districtName: "Kampala", districtSlug: "kampala", temperatureC: 22 }),
    );

    expect(getStoredWidgetData()).toBeNull();
  });

  it("safely handles missing or throwing bridge methods without crashing", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    // 1. Android WidgetBridge without updateWidgetData method
    (window as unknown as { WidgetBridge?: unknown }).WidgetBridge = {};

    // 2. WebKit messageHandlers without postMessage method
    (window as unknown as { webkit?: unknown }).webkit = {
      messageHandlers: {
        widgetUpdate: {}, // missing postMessage function
      },
    };

    try {
      // Must not throw even if bridge methods are missing
      const result = await syncWidgetData(mockBundle);
      expect(result).not.toBeNull();
      expect(result?.districtName).toBe("Kampala");
    } finally {
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      delete (window as unknown as { webkit?: unknown }).webkit;
      nativePlatformSpy.mockRestore();
    }
  });

  it("safely catches bridge execution errors without interrupting event dispatch", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    // Android bridge throws an unexpected error
    (window as unknown as { WidgetBridge?: unknown }).WidgetBridge = {
      updateWidgetData: vi.fn(() => {
        throw new Error("Android SharedPreferences disk I/O error");
      }),
    };

    const eventListener = vi.fn();
    window.addEventListener("ugandaweather:widget-update", eventListener);

    try {
      const result = await syncWidgetData(mockBundle);
      expect(result).not.toBeNull();
      // Even if Android bridge threw, custom window event was still safely dispatched
      expect(eventListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("ugandaweather:widget-update", eventListener);
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      nativePlatformSpy.mockRestore();
    }
  });

  it("keeps missing or non-finite weather values unavailable", () => {
    const corruptedBundle: WeatherBundle = {
      ...mockBundle,
      temperature: {
        celsius: NaN,
        feelsLike: Infinity,
      },
      daily: {
        high: -Infinity,
        low: NaN,
      },
      precipitation: {
        mm: 0,
        chance: NaN,
      },
      hourly: [
        {
          time: "2026-10-12T15:00:00Z",
          label: "15:00",
          temp: NaN,
          icon: "",
          theme: "clear",
          isDay: true,
          kind: "hour",
          rainChance: Infinity,
        },
      ],
    };

    const extracted = extractWidgetData(corruptedBundle);
    expect(extracted.temperatureC).toBeNull();
    expect(extracted.feelsLikeC).toBeNull();
    expect(extracted.highC).toBeNull();
    expect(extracted.lowC).toBeNull();
    expect(extracted.precipitationChance).toBeNull();
    expect(extracted.hourlyTimeline?.[0]?.tempC).toBeNull();
    expect(extracted.hourlyTimeline?.[0]?.rainChance).toBeNull();
  });

  it("never sends sample weather to the widgets", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const updateWidgetDataMock = vi.fn();
    (window as unknown as { WidgetBridge?: { updateWidgetData: (json: string) => void } }).WidgetBridge = {
      updateWidgetData: updateWidgetDataMock,
    };

    try {
      for (const source of ["demo", "demo-fallback"]) {
        const sampleBundle: WeatherBundle = { ...mockBundle, source };
        expect(isSampleWeather(sampleBundle)).toBe(true);
        expect(await syncWidgetData(sampleBundle)).toBeNull();
      }
      expect(updateWidgetDataMock).not.toHaveBeenCalled();
      expect(getStoredWidgetData()).toBeNull();
      expect(isSampleWeather(mockBundle)).toBe(false);
    } finally {
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      nativePlatformSpy.mockRestore();
    }
  });

  it("sends widget data through the WidgetData plugin on Android builds that have it", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const platformSpy = vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    const pluginSpy = vi.spyOn(Capacitor, "isPluginAvailable").mockReturnValue(true);
    const legacyMock = vi.fn();
    (window as unknown as { WidgetBridge?: { updateWidgetData: (json: string) => void } }).WidgetBridge = {
      updateWidgetData: legacyMock,
    };
    pluginUpdateMock.mockClear();

    try {
      await syncWidgetData(mockBundle);
      expect(pluginSpy).toHaveBeenCalledWith("WidgetData");
      expect(pluginUpdateMock).toHaveBeenCalledTimes(1);
      const passed = JSON.parse(pluginUpdateMock.mock.calls[0][0].json);
      expect(passed.districtSlug).toBe("kampala");
      expect(legacyMock).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      nativePlatformSpy.mockRestore();
      platformSpy.mockRestore();
      pluginSpy.mockRestore();
    }
  });

  it("does not fall back to the older bridge when the plugin rejects the data", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const nativePlatformSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const platformSpy = vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    const pluginSpy = vi.spyOn(Capacitor, "isPluginAvailable").mockReturnValue(true);
    const legacyMock = vi.fn();
    (window as unknown as { WidgetBridge?: { updateWidgetData: (json: string) => void } }).WidgetBridge = {
      updateWidgetData: legacyMock,
    };
    pluginUpdateMock.mockClear();
    pluginUpdateMock.mockRejectedValueOnce(new Error("Widget data has no district"));

    try {
      const result = await syncWidgetData(mockBundle);
      expect(result).not.toBeNull();
      expect(pluginUpdateMock).toHaveBeenCalledTimes(1);
      expect(legacyMock).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as { WidgetBridge?: unknown }).WidgetBridge;
      nativePlatformSpy.mockRestore();
      platformSpy.mockRestore();
      pluginSpy.mockRestore();
    }
  });
});
