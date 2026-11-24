interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
/** Above this many tracked keys, expired buckets are swept out so memory does
    not grow with every new visitor address for the life of the server. */
const SWEEP_THRESHOLD = 5_000;
/** The sweep walks every key, so it runs at most this often; a flood of
    requests cannot make every single request pay for a full walk. */
const SWEEP_INTERVAL_MS = 10_000;
/** Hard ceiling on tracked keys. If a flood of new addresses fills it before
    their windows expire, the oldest keys are dropped first. */
const MAX_TRACKED_KEYS = 20_000;
let lastSweepAt = 0;

function sweepExpiredBuckets(now: number): void {
  if (buckets.size >= SWEEP_THRESHOLD && now - lastSweepAt >= SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  if (buckets.size >= MAX_TRACKED_KEYS) {
    let toDrop = buckets.size - MAX_TRACKED_KEYS + 1;
    for (const key of buckets.keys()) {
      if (toDrop <= 0) break;
      buckets.delete(key);
      toDrop -= 1;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  sweepExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, limit, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function trackedRateLimitKeysForTests(): number {
  return buckets.size;
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  lastSweepAt = 0;
}
