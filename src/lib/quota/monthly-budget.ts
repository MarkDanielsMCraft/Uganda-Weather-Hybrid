import { getRedisClient, redisExpire, redisIncr } from "@/lib/cache/redis";

/** Roughly 40 days, long enough to outlive a full calendar month plus
    timezone slack, short enough that a stale key can't accumulate forever
    if EXPIRE somehow never gets set. */
const QUOTA_KEY_TTL_SECONDS = 40 * 24 * 60 * 60;

const memoryCounts = new Map<string, number>();

function currentMonthKey(providerKey: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `ug:quota:${providerKey}:${month}`;
}

async function reserveQuotaRedis(key: string, monthlyBudget: number): Promise<boolean> {
  const count = await redisIncr(key);
  if (count === 1) {
    await redisExpire(key, QUOTA_KEY_TTL_SECONDS);
  }
  return count > 0 && count <= monthlyBudget;
}

function reserveQuotaMemory(key: string, monthlyBudget: number): boolean {
  const count = (memoryCounts.get(key) ?? 0) + 1;
  memoryCounts.set(key, count);
  return count <= monthlyBudget;
}

/** Atomically reserves one call against a provider's monthly budget.
    Returns false once the current UTC month's budget is used up, so
    callers treat it exactly like a provider error: skip this provider,
    fall through to the next tier. INCR-first (not check-then-increment) so
    concurrent serverless invocations can't race past the cap, worst case
    it over-counts by the requests that lose the race, never under-counts.

    This is a defense-in-depth layer, not the sole guarantee, for any
    provider whose free tier can turn into real billing past its cap.
    The authoritative guarantee for those has to be a hard quota set on
    the provider's own platform console; this counter exists to fail
    gracefully well before that platform-level limit is ever hit. */
export async function reserveQuota(providerKey: string, monthlyBudget: number): Promise<boolean> {
  const key = currentMonthKey(providerKey);

  if (getRedisClient()) {
    try {
      return await reserveQuotaRedis(key, monthlyBudget);
    } catch (error) {
      console.error(`Quota check failed for ${providerKey}, using memory fallback:`, error);
    }
  }

  return reserveQuotaMemory(key, monthlyBudget);
}
