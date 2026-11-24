import { describe, expect, it, vi } from "vitest";
import { createMeta, errorResponse, getCachedMemory, jsonResponse } from "./memory";

describe("getCachedMemory", () => {
  it("calls the fetcher on a cache miss and serves from cache on the next call", async () => {
    const key = `test-${Math.random()}`;
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });

    const first = await getCachedMemory(key, 60, fetcher);
    expect(first).toEqual({ data: { value: 1 }, stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const second = await getCachedMemory(key, 60, fetcher);
    expect(second).toEqual({ data: { value: 1 }, stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1); // still 1 — served from cache
  });

  it("re-fetches once the TTL has elapsed", async () => {
    const key = `test-${Math.random()}`;
    const fetcher = vi.fn().mockResolvedValueOnce({ value: "old" }).mockResolvedValueOnce({ value: "new" });

    await getCachedMemory(key, 0, fetcher); // TTL 0 -> expires immediately
    const second = await getCachedMemory(key, 60, fetcher);
    expect(second).toEqual({ data: { value: "new" }, stale: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("serves stale cached data when a refetch fails, instead of throwing", async () => {
    const key = `test-${Math.random()}`;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: "good" })
      .mockRejectedValueOnce(new Error("upstream down"));

    await getCachedMemory(key, 0, fetcher); // populate cache, TTL 0 so it's immediately stale
    const result = await getCachedMemory(key, 60, fetcher);
    expect(result).toEqual({ data: { value: "good" }, stale: true });
  });

  it("propagates the error when there's no cached fallback to serve", async () => {
    const key = `test-${Math.random()}`;
    const fetcher = vi.fn().mockRejectedValue(new Error("upstream down"));
    await expect(getCachedMemory(key, 60, fetcher)).rejects.toThrow("upstream down");
  });

  it("coalesces concurrent requests for the same uncached key into a single fetcher execution", async () => {
    const key = `test-single-flight-${Math.random()}`;
    let resolveSlowFetch: ((val: { count: number }) => void) | null = null;
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveSlowFetch = resolve;
      });
    });

    // Fire 5 concurrent requests while key is not in cache
    const promise1 = getCachedMemory(key, 60, fetcher);
    const promise2 = getCachedMemory(key, 60, fetcher);
    const promise3 = getCachedMemory(key, 60, fetcher);
    const promise4 = getCachedMemory(key, 60, fetcher);
    const promise5 = getCachedMemory(key, 60, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveSlowFetch!({ count: 42 });

    const [res1, res2, res3, res4, res5] = await Promise.all([
      promise1,
      promise2,
      promise3,
      promise4,
      promise5,
    ]);

    expect(res1.data).toEqual({ count: 42 });
    expect(res2.data).toEqual({ count: 42 });
    expect(res3.data).toEqual({ count: 42 });
    expect(res4.data).toEqual({ count: 42 });
    expect(res5.data).toEqual({ count: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("evicts degraded daily forecast bundles on refetch failure instead of serving them stale", async () => {
    const key = `test-degraded-${Math.random()}`;
    const degradedBundle = { dailyForecast: [1, 2, 3] };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(degradedBundle)
      .mockRejectedValueOnce(new Error("upstream down"));

    // First call stores degraded bundle with 0 TTL
    await getCachedMemory(key, 0, fetcher);

    // Second call fails refetch; should evict rather than serve degraded bundle stale
    await expect(getCachedMemory(key, 60, fetcher)).rejects.toThrow("upstream down");
  });
});

describe("createMeta", () => {
  it("includes a request id, timestamp, and the stale flag", () => {
    const meta = createMeta(true);
    expect(meta.stale).toBe(true);
    expect(meta.requestId).toBeTruthy();
    expect(new Date(meta.cachedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("jsonResponse / errorResponse", () => {
  it("wraps success payloads under data/meta", async () => {
    const res = jsonResponse({ hello: "world" }, createMeta());
    const body = await res.json();
    expect(body.data).toEqual({ hello: "world" });
    expect(body.meta.requestId).toBeTruthy();
  });

  it("wraps error payloads with code/message and sets the HTTP status", async () => {
    const res = errorResponse("NOT_FOUND", "District not found", 404, { slug: "nowhere" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toEqual({
      code: "NOT_FOUND",
      message: "District not found",
      details: { slug: "nowhere" },
    });
  });
});

describe("memory cache ceiling", () => {
  it("never holds more than 5000 entries, however many addresses are tried", async () => {
    const { getCachedMemory, memoryCacheSizeForTests, clearMemoryCacheForTests } = await import(
      "@/lib/cache/memory"
    );
    clearMemoryCacheForTests();
    for (let i = 0; i < 5_200; i += 1) {
      await getCachedMemory(`attack-key-${i}`, 600, async () => ({ i }));
    }
    expect(memoryCacheSizeForTests()).toBeLessThanOrEqual(5_000);
    const newest = await getCachedMemory("attack-key-5199", 600, async () => ({ i: -1 }));
    expect(newest.data).toEqual({ i: 5199 });
    clearMemoryCacheForTests();
  });
});
