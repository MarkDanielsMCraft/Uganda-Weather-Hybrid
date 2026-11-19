import { describe, expect, it, vi } from "vitest";

describe("reserveQuota (memory path, no Redis configured in test env)", () => {
  it("allows calls up to the budget and denies past it", async () => {
    const { reserveQuota } = await import("./monthly-budget");
    const providerKey = `test-${Math.random()}`;

    expect(await reserveQuota(providerKey, 2)).toBe(true);
    expect(await reserveQuota(providerKey, 2)).toBe(true);
    expect(await reserveQuota(providerKey, 2)).toBe(false);
    expect(await reserveQuota(providerKey, 2)).toBe(false);
  });

  it("tracks separate providers independently", async () => {
    const { reserveQuota } = await import("./monthly-budget");
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;

    expect(await reserveQuota(a, 1)).toBe(true);
    expect(await reserveQuota(a, 1)).toBe(false);
    expect(await reserveQuota(b, 1)).toBe(true);
  });
});

describe("reserveQuota (Redis path)", () => {
  it("increments atomically via INCR and sets EXPIRE only on the first increment", async () => {
    const { redisIncrMock, redisExpireMock } = vi.hoisted(() => ({
      redisIncrMock: vi.fn(),
      redisExpireMock: vi.fn(),
    }));

    vi.resetModules();
    vi.doMock("@/lib/cache/redis", () => ({
      getRedisClient: () => true,
      redisIncr: redisIncrMock,
      redisExpire: redisExpireMock,
    }));

    redisIncrMock.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const { reserveQuota } = await import("./monthly-budget");
    const providerKey = `test-redis-${Math.random()}`;

    expect(await reserveQuota(providerKey, 2)).toBe(true);
    expect(await reserveQuota(providerKey, 2)).toBe(true);
    expect(await reserveQuota(providerKey, 2)).toBe(false);

    expect(redisExpireMock).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/lib/cache/redis");
    vi.resetModules();
  });

  it("falls back to the memory path if the Redis call throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/cache/redis", () => ({
      getRedisClient: () => true,
      redisIncr: vi.fn().mockRejectedValue(new Error("Upstash down")),
      redisExpire: vi.fn(),
    }));

    const { reserveQuota } = await import("./monthly-budget");
    const providerKey = `test-redis-fallback-${Math.random()}`;

    expect(await reserveQuota(providerKey, 1)).toBe(true);
    expect(await reserveQuota(providerKey, 1)).toBe(false);

    vi.doUnmock("@/lib/cache/redis");
    vi.resetModules();
  });
});
