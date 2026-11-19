import { getCachedRedis, getRedisClient } from "./redis";
import { getCachedMemory } from "./memory";

const inflight = new Map<string, Promise<{ data: unknown; stale: boolean }>>();

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const existingInflight = inflight.get(key);
  if (existingInflight) {
    return existingInflight as Promise<{ data: T; stale: boolean }>;
  }

  const activePromise = (async () => {
    try {
      if (getRedisClient()) {
        try {
          return await getCachedRedis(key, ttlSeconds, fetcher);
        } catch (error) {
          console.error("Redis cache unavailable, using memory:", error);
        }
      }
      return await getCachedMemory(key, ttlSeconds, fetcher);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, activePromise);
  return activePromise as Promise<{ data: T; stale: boolean }>;
}

export { createMeta, jsonResponse, errorResponse } from "./memory";
