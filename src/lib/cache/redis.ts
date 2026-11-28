import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

interface RedisCachePayload<T> {
  value: T;
  expiresAt: number;
}

const UPSTASH_TIMEOUT_MS = 3_000;

function getRedisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  return url && token ? { url, token } : null;
}

function redisConfigured() {
  return getRedisCredentials() !== null;
}

async function redisCommand<T = unknown>(
  command: (string | number)[],
  timeoutMs = UPSTASH_TIMEOUT_MS,
): Promise<T | null> {
  const credentials = getRedisCredentials();
  if (!credentials) return null;

  const response = await fetchWithTimeout(
    (signal) =>
      fetch(credentials.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        cache: "no-store",
        signal,
      }),
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Upstash error: ${response.status}`);
  }

  const payload = (await response.json()) as { result?: T | string | null };
  const result = payload.result ?? null;
  if (result === null) return null;
  return result as T;
}

async function redisGetJsonInternal<T>(
  key: string,
  timeoutMs = UPSTASH_TIMEOUT_MS,
): Promise<T | null> {
  const raw = await redisCommand<string | T>(["GET", key], timeoutMs);
  if (!raw) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as T;
  }
  return raw;
}

export function getRedisClient(): boolean {
  return redisConfigured();
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number,
  timeoutMs = UPSTASH_TIMEOUT_MS,
): Promise<void> {
  if (!redisConfigured()) return;
  const command: (string | number)[] =
    ttlSeconds != null ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value];
  await redisCommand(command, timeoutMs);
}

export async function redisDel(...keys: string[]): Promise<void> {
  if (!redisConfigured() || keys.length === 0) return;
  await redisCommand(["DEL", ...keys]);
}

export async function redisSadd(key: string, member: string): Promise<void> {
  if (!redisConfigured()) return;
  await redisCommand(["SADD", key, member]);
}

export async function redisSrem(key: string, member: string): Promise<void> {
  if (!redisConfigured()) return;
  await redisCommand(["SREM", key, member]);
}

export async function redisScard(key: string): Promise<number> {
  if (!redisConfigured()) return 0;
  const count = await redisCommand<number>(["SCARD", key]);
  return typeof count === "number" ? count : 0;
}

export async function redisIncr(key: string): Promise<number> {
  if (!redisConfigured()) return 0;
  const count = await redisCommand<number>(["INCR", key]);
  return typeof count === "number" ? count : 0;
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  if (!redisConfigured()) return;
  await redisCommand(["EXPIRE", key, ttlSeconds]);
}

export async function redisSmembers(key: string): Promise<string[]> {
  if (!redisConfigured()) return [];
  const members = await redisCommand<string[]>(["SMEMBERS", key]);
  return Array.isArray(members) ? members : [];
}

export async function redisGetJson<T>(
  key: string,
  timeoutMs = UPSTASH_TIMEOUT_MS,
): Promise<T | null> {
  return redisGetJsonInternal<T>(key, timeoutMs);
}

export async function getCachedRedis<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  if (!redisConfigured()) {
    throw new Error("Redis client not configured");
  }

  const staleKey = `${key}:stale`;
  const now = Date.now();

  const cached = await redisGetJsonInternal<RedisCachePayload<T>>(key);
  if (cached && cached.expiresAt > now) {
    return { data: cached.value, stale: false };
  }

  try {
    const data = await fetcher();
    const isDegradedBundle =
      typeof data === "object" &&
      data !== null &&
      "dailyForecast" in data &&
      Array.isArray((data as { dailyForecast: unknown[] }).dailyForecast) &&
      (data as { dailyForecast: unknown[] }).dailyForecast.length < 10;

    const effectiveTtl = isDegradedBundle ? Math.min(ttlSeconds, 15) : ttlSeconds;

    const payload: RedisCachePayload<T> = {
      value: data,
      expiresAt: now + effectiveTtl * 1000,
    };
    const serialized = JSON.stringify(payload);

    await Promise.all([
      redisCommand(["SET", key, serialized, "EX", effectiveTtl]),
      redisCommand(["SET", staleKey, serialized, "EX", isDegradedBundle ? 30 : 86400]),
    ]);

    return { data, stale: false };
  } catch (error) {
    const stale =
      (await redisGetJsonInternal<RedisCachePayload<T>>(staleKey)) ?? cached;
    if (stale) {
      return { data: stale.value, stale: true };
    }
    throw error;
  }
}
