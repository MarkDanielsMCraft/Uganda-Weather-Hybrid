import type { WeatherBundle } from "@/types/weather";

const STORAGE_KEY = "uw:weather-cache:v5";
const MAX_ENTRIES = 12;

interface CachedWeatherEntry {
  slug: string;
  savedAt: string;
  response: { data: WeatherBundle; meta: { requestId: string; cachedAt: string; stale?: boolean } };
}

interface WeatherCacheStore {
  entries: Record<string, CachedWeatherEntry>;
}

function readStore(): WeatherCacheStore {
  if (typeof window === "undefined") return { entries: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: {} };
    return JSON.parse(raw) as WeatherCacheStore;
  } catch {
    return { entries: {} };
  }
}

function writeStore(store: WeatherCacheStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    // Offline caching is a nice-to-have, not the primary operation — a
    // full quota (Safari private browsing throws on every setItem, or
    // localStorage genuinely full) must not fail the weather fetch that
    // just succeeded and is calling this synchronously afterward.
    console.error("Failed to persist offline weather cache:", error);
  }
}

export function saveWeatherCache(
  slug: string,
  response: CachedWeatherEntry["response"],
) {
  // Do not persist incomplete forecast bundles to offline storage so degraded
  // forecasts cannot become sticky offline fallbacks.
  if (!response?.data?.dailyForecast || response.data.dailyForecast.length < 10) {
    return;
  }

  const store = readStore();
  store.entries[slug] = {
    slug,
    savedAt: new Date().toISOString(),
    response,
  };

  const keys = Object.keys(store.entries);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort(
      (a, b) =>
        new Date(store.entries[b].savedAt).getTime() -
        new Date(store.entries[a].savedAt).getTime(),
    );
    for (const key of sorted.slice(MAX_ENTRIES)) {
      delete store.entries[key];
    }
  }

  writeStore(store);
}

export function loadWeatherCache(slug: string) {
  const store = readStore();
  const entry = store.entries[slug];
  if (!entry) return null;

  if (!entry.response?.data?.dailyForecast || entry.response.data.dailyForecast.length < 10) {
    delete store.entries[slug];
    writeStore(store);
    return null;
  }

  return {
    ...entry.response,
    data: { ...entry.response.data, stale: true },
    meta: { ...entry.response.meta, stale: true },
  };
}

