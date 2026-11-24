// `node:crypto`, not `crypto`. The bare specifier is one webpack happily
// resolves to a browser polyfill if this module ever becomes reachable from
// client code, silently adding ~320 kB of elliptic-curve and ASN.1
// JavaScript to the bundle. The `node:` prefix has no browser shim, so the
// same mistake surfaces as a build error rather than a quiet payload.
import { randomUUID } from "node:crypto";
import type { ApiMeta } from "@/types/weather";

export function createMeta(stale = false): ApiMeta {
  return {
    requestId: randomUUID(),
    cachedAt: new Date().toISOString(),
    stale,
  };
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function isDegradedBundle(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "dailyForecast" in value &&
    Array.isArray((value as { dailyForecast: unknown[] }).dailyForecast) &&
    (value as { dailyForecast: unknown[] }).dailyForecast.length < 10
  );
}

/** Every distinct address can create an entry, so without a ceiling a script
    could fill server memory. When full, expired entries go first, then the
    ones used least recently (a Map keeps order, and a hit moves an entry to
    the back). */
const MAX_MEMORY_CACHE_ENTRIES = 5_000;

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<{ data: unknown; stale: boolean }>>();

function makeRoomForOneEntry(now: number) {
  if (store.size < MAX_MEMORY_CACHE_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function memoryCacheSizeForTests(): number {
  return store.size;
}

export function clearMemoryCacheForTests(): void {
  store.clear();
  inflight.clear();
}

export async function getCachedMemory<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    // Moving a used entry to the back keeps busy places such as Kampala
    // saved while a flood of one off addresses pushes out only each other.
    store.delete(key);
    store.set(key, entry);
    return { data: entry.value, stale: false };
  }

  const existingInflight = inflight.get(key);
  if (existingInflight) {
    return existingInflight as Promise<{ data: T; stale: boolean }>;
  }

  const activePromise = (async () => {
    try {
      const data = await fetcher();
      const degraded = isDegradedBundle(data);
      const effectiveTtl = degraded ? Math.min(ttlSeconds, 15) : ttlSeconds;
      store.delete(key);
      makeRoomForOneEntry(Date.now());
      store.set(key, { value: data, expiresAt: Date.now() + effectiveTtl * 1000 });
      return { data, stale: false };
    } catch (error) {
      if (entry) {
        if (!isDegradedBundle(entry.value)) {
          return { data: entry.value, stale: true };
        }
        store.delete(key);
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, activePromise);
  return activePromise as Promise<{ data: T; stale: boolean }>;
}

export function jsonResponse<T>(data: T, meta: ApiMeta, init?: ResponseInit) {
  return Response.json({ data, meta }, init);
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      error: { code, message, details },
      meta: createMeta(),
    },
    { status },
  );
}
