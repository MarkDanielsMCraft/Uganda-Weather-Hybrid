import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRedisClient, redisSet } from "./redis";

describe("Upstash Redis environment variables", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_KV_REST_API_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_KV_REST_API_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the canonical REST variables", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "canonical-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "OK" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(getRedisClient()).toBe(true);
    await redisSet("push:tokens", "value");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer canonical-token",
        }),
        body: JSON.stringify(["SET", "push:tokens", "value"]),
      }),
    );
  });

  it("uses the Upstash Vercel integration REST variables", async () => {
    vi.stubEnv(
      "UPSTASH_REDIS_REST_KV_REST_API_URL",
      "https://integration-redis.example",
    );
    vi.stubEnv(
      "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
      "integration-token",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "OK" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(getRedisClient()).toBe(true);
    await redisSet("push:tokens", "value");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://integration-redis.example",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer integration-token",
        }),
        body: JSON.stringify(["SET", "push:tokens", "value"]),
      }),
    );
  });

  it("does not configure Redis when either credential is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_KV_REST_API_URL", "https://integration-redis.example");

    expect(getRedisClient()).toBe(false);
  });
});
