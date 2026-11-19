import type { District, WeatherAlert } from "@/types/weather";
import {
  capAlertsToWeatherAlerts,
  DEFAULT_UNMA_CAP_FEED,
  parseCapRssFeed,
} from "./cap";

const FEED_TTL_MS = 5 * 60 * 1000;

let feedCache: { fetchedAt: number; parsed: ReturnType<typeof parseCapRssFeed> } | null =
  null;

async function loadUnmaCapFeed(signal?: AbortSignal) {
  const now = Date.now();
  if (feedCache && now - feedCache.fetchedAt < FEED_TTL_MS) {
    return feedCache.parsed;
  }

  const timeoutSignal = AbortSignal.timeout(6_000);
  const activeSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const feedUrl = process.env.UNMA_ALERTS_URL ?? DEFAULT_UNMA_CAP_FEED;
  const response = await fetch(feedUrl, {
    signal: activeSignal,
    next: { revalidate: 300 },
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!response.ok) {
    throw new Error(`UNMA CAP feed returned ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parseCapRssFeed(xml);
  feedCache = { fetchedAt: now, parsed };
  return parsed;
}

/** Reset in-memory feed cache (tests only). */
export function resetUnmaFeedCache() {
  feedCache = null;
}

/**
 * UNMA / DMS CAP alerts from the WMO Alert Hub mirror feed.
 * Falls back gracefully when the feed is empty or unreachable.
 */
export async function fetchUnmaAlerts(
  district: District,
  signal?: AbortSignal,
): Promise<WeatherAlert[]> {
  try {
    const parsed = await loadUnmaCapFeed(signal);
    return capAlertsToWeatherAlerts(parsed, district);
  } catch (error) {
    console.error(`UNMA CAP feed failed for ${district.slug}:`, error);
    return [];
  }
}
