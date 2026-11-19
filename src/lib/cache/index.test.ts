import { describe, expect, it, vi, beforeEach } from "vitest";
import { getCached } from "./index";
import * as redisModule from "./redis";
import * as memoryModule from "./memory";

describe("getCached single-flight coalescing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("coalesces concurrent requests for the same key into a single active promise execution", async () => {
    const key = `single-flight-test-${Math.random()}`;
    let resolveFetcher: ((val: { name: string }) => void) | null = null;
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveFetcher = resolve;
      });
    });

    // Make 4 concurrent getCached calls for the same key
    const p1 = getCached(key, 60, fetcher);
    const p2 = getCached(key, 60, fetcher);
    const p3 = getCached(key, 60, fetcher);
    const p4 = getCached(key, 60, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetcher!({ name: "Kampala Weather" });

    const [r1, r2, r3, r4] = await Promise.all([p1, p2, p3, p4]);

    expect(r1.data).toEqual({ name: "Kampala Weather" });
    expect(r2.data).toEqual({ name: "Kampala Weather" });
    expect(r3.data).toEqual({ name: "Kampala Weather" });
    expect(r4.data).toEqual({ name: "Kampala Weather" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("removes the inflight promise from the map on error so future requests can retry", async () => {
    const key = `single-flight-error-${Math.random()}`;
    const failingFetcher = vi.fn().mockRejectedValueOnce(new Error("API timeout"));

    // First call rejects
    await expect(getCached(key, 60, failingFetcher)).rejects.toThrow("API timeout");

    // Second call should NOT be stuck on the failed in-flight promise; it must execute fresh
    const recoveryFetcher = vi.fn().mockResolvedValue({ recovered: true });
    const result = await getCached(key, 60, recoveryFetcher);
    expect(result.data).toEqual({ recovered: true });
    expect(recoveryFetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to memory cache when Redis throws an unexpected error", async () => {
    const key = `redis-fallback-test-${Math.random()}`;
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(
      {} as unknown as ReturnType<typeof redisModule.getRedisClient>,
    );
    vi.spyOn(redisModule, "getCachedRedis").mockRejectedValue(new Error("Redis connection lost"));
    const memorySpy = vi.spyOn(memoryModule, "getCachedMemory").mockResolvedValue({
      data: { fallback: true },
      stale: false,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getCached(key, 60, async () => ({ value: 123 }));
    expect(memorySpy).toHaveBeenCalledWith(key, 60, expect.any(Function));
    expect(result.data).toEqual({ fallback: true });

    consoleSpy.mockRestore();
  });
});
