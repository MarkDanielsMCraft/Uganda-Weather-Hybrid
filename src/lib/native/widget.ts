import type { WeatherBundle } from "@/types/weather";
import { isNativeApp } from "./platform";

export interface WidgetHourlyPoint {
  time: string;
  label: string;
  tempC: number | null;
  conditionTheme: string;
  rainChance: number | null;
  kind: "hour" | "sunset" | "sunrise";
}

export interface WidgetDailyPoint {
  day: string;
  conditionTheme: string;
  highC: number | null;
  lowC: number | null;
  rainChance: number | null;
}

export interface WeatherWidgetData {
  districtName: string;
  districtSlug: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  conditionText: string;
  conditionTheme: string;
  highC: number | null;
  lowC: number | null;
  precipitationChance: number | null;
  windSpeedKph?: number | null;
  uvIndex?: number | null;
  humidity?: number | null;
  sunriseText?: string | null;
  sunsetText?: string | null;
  hasActiveAlert: boolean;
  alertTitle: string | null;
  updatedAt: string;
  aqi?: number | null;
  aqiCategory?: string | null;
  agroSeason?: string | null;
  isLakeZone?: boolean;
  hourlyTimeline?: WidgetHourlyPoint[];
  dailyForecast?: WidgetDailyPoint[];
}

const WIDGET_STORAGE_KEY = "uw:widget:data:v2";

function safeRound(value: number | undefined | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function extractWidgetData(bundle: WeatherBundle): WeatherWidgetData {
  const activeAlert = bundle?.alerts && bundle.alerts.length > 0 ? bundle.alerts[0] : null;

  const hourlyTimeline: WidgetHourlyPoint[] = (bundle?.hourly ?? [])
    .filter((point) => point.kind === "hour")
    .slice(0, 12)
    .map((point) => ({
      time: point.time,
      label: point.label,
      tempC: safeRound(point.temp),
      conditionTheme: point.theme ?? "unknown",
      rainChance: safeRound(point.rainChance),
      kind: point.kind,
    }));

  return {
    districtName: bundle.district.name,
    districtSlug: bundle.district.slug,
    temperatureC: safeRound(bundle.temperature.celsius),
    feelsLikeC: safeRound(bundle.temperature.feelsLike),
    conditionText: bundle.condition.text || "Weather unavailable",
    conditionTheme: bundle.condition.theme,
    highC: safeRound(bundle.daily.high),
    lowC: safeRound(bundle.daily.low),
    precipitationChance: safeRound(bundle.precipitation.chance),
    windSpeedKph: safeRound(bundle.wind?.speedKph),
    uvIndex: safeRound(bundle.uvIndex),
    humidity: safeRound(bundle.humidity),
    sunriseText: bundle.astronomy?.sunrise || null,
    sunsetText: bundle.astronomy?.sunset || null,
    hasActiveAlert: Boolean(activeAlert),
    alertTitle: activeAlert ? activeAlert.title : null,
    updatedAt: bundle.updatedAt,
    aqi: safeRound(bundle.airQuality?.aqi),
    aqiCategory: bundle.airQuality?.category || null,
    agroSeason: bundle.district?.rainfallPattern || null,
    isLakeZone: Boolean(bundle.district?.isLakeVictoriaZone || bundle.district?.lakeZone),
    hourlyTimeline,
    dailyForecast: (bundle?.dailyForecast ?? [])
      .slice(0, 5)
      .map((point) => ({
        day: point.day,
        conditionTheme: point.theme ?? "unknown",
        highC: safeRound(point.high),
        lowC: safeRound(point.low),
        rainChance: safeRound(point.rainChance),
      })),
  };
}

/**
 * The server falls back to sample weather (source "demo" or "demo-fallback") when every
 * provider fails. The website labels it, but a home screen widget has no room to, so
 * sample weather must never reach the widgets.
 */
export function isSampleWeather(bundle: WeatherBundle): boolean {
  return typeof bundle?.source === "string" && bundle.source.startsWith("demo");
}

interface WidgetDataPlugin {
  update(options: { json: string }): Promise<void>;
}

let widgetDataPlugin: WidgetDataPlugin | null = null;

/**
 * Android builds from this release on receive widget data through the WidgetData
 * Capacitor plugin, which only accepts calls from the app's own main page. Builds
 * already installed on phones only have the older WidgetBridge interface, and the
 * website serves both, so the older path stays as a fallback.
 */
async function sendToAndroidWidgets(jsonString: string): Promise<void> {
  let hasPlugin = false;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    hasPlugin = Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("WidgetData");
    if (hasPlugin) {
      widgetDataPlugin ??= registerPlugin<WidgetDataPlugin>("WidgetData");
      await widgetDataPlugin.update({ json: jsonString });
    }
  } catch {
    // A rejected plugin call is non fatal; the widgets keep their last data
  }
  if (hasPlugin) return;

  try {
    const androidBridge = (
      window as unknown as { WidgetBridge?: { updateWidgetData?: (json: string) => void } }
    ).WidgetBridge;
    if (androidBridge && typeof androidBridge.updateWidgetData === "function") {
      androidBridge.updateWidgetData(jsonString);
    }
  } catch {
    // Android bridge call failure is non fatal
  }
}

export async function syncWidgetData(bundle: WeatherBundle): Promise<WeatherWidgetData | null> {
  if (typeof window === "undefined") return null;
  if (isSampleWeather(bundle)) return null;

  let data: WeatherWidgetData;
  try {
    data = extractWidgetData(bundle);
  } catch {
    return null;
  }

  let jsonString: string;
  try {
    jsonString = JSON.stringify(data);
  } catch {
    return null;
  }

  try {
    localStorage.setItem(WIDGET_STORAGE_KEY, jsonString);
  } catch {
    // Local storage failure is non fatal
  }

  if (await isNativeApp()) {
    // 1. Android: store the data for the home screen widgets and refresh them
    await sendToAndroidWidgets(jsonString);

    // 2. Call WebKit ScriptMessageHandler to write to shared UserDefaults & refresh widgets
    try {
      const webkitHandler = (
        window as unknown as {
          webkit?: {
            messageHandlers?: {
              widgetUpdate?: { postMessage?: (msg: string) => void };
            };
          };
        }
      ).webkit;
      if (typeof webkitHandler?.messageHandlers?.widgetUpdate?.postMessage === "function") {
        webkitHandler.messageHandlers.widgetUpdate.postMessage(jsonString);
      }
    } catch {
      // Webkit call failure is non fatal
    }

    // 3. Dispatches custom window event so in-browser or hybrid listeners can also observe
    try {
      window.dispatchEvent(
        new CustomEvent("ugandaweather:widget-update", { detail: data }),
      );
    } catch {
      // Window event dispatch failure is non fatal
    }
  }

  return data;
}

export function getStoredWidgetData(): WeatherWidgetData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.districtSlug !== "string" ||
      typeof parsed.districtName !== "string"
    ) {
      return null;
    }
    return parsed as WeatherWidgetData;
  } catch {
    return null;
  }
}
