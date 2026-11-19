import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = {
  configured: false,
  sets: new Map<string, Set<string>>(),
  values: new Map<string, string>(),
};

function redisSetMembers(key: string) {
  return redisState.sets.get(key) ?? new Set<string>();
}

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => redisState.configured,
  redisSet: vi.fn(async (key: string, value: string) => {
    redisState.values.set(key, value);
  }),
  redisDel: vi.fn(async (...keys: string[]) => {
    for (const key of keys) redisState.values.delete(key);
  }),
  redisSadd: vi.fn(async (key: string, member: string) => {
    const set = redisState.sets.get(key) ?? new Set<string>();
    set.add(member);
    redisState.sets.set(key, set);
  }),
  redisSrem: vi.fn(async (key: string, member: string) => {
    redisState.sets.get(key)?.delete(member);
  }),
  redisScard: vi.fn(async (key: string) => redisSetMembers(key).size),
  redisSmembers: vi.fn(async (key: string) => [...redisSetMembers(key)]),
  redisGetJson: vi.fn(async <T>(key: string) => {
    const raw = redisState.values.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }),
}));

const { savePushToken, removePushToken, listDistrictSlugsWithPushTokens, resetPushStoreForTests } =
  await import("./store");

describe("push token store — cross-instance behavior", () => {
  beforeEach(() => {
    resetPushStoreForTests();
    redisState.configured = false;
    redisState.sets.clear();
    redisState.values.clear();
  });

  it("finds districts registered only in Redis, not the local in-memory store", async () => {
    // Regression test: a fresh serverless instance (e.g. a cron
    // invocation) starts with an empty in-memory store. Before this fix,
    // listDistrictSlugsWithPushTokens only ever looked at memory, so a
    // token saved by a *different* instance (visible only via Redis)
    // would never be found — the storm-alert dispatch cron would scan
    // zero districts even though tokens were registered.
    redisState.configured = true;
    await savePushToken({ token: "device-token-1", platform: "android", districtSlug: "kampala" });

    // Simulate a fresh instance: wipe local memory, keep "Redis" state.
    resetPushStoreForTests();

    const slugs = await listDistrictSlugsWithPushTokens();
    expect(slugs).toContain("kampala");
  });

  it("still works with only the in-memory store when Redis isn't configured", async () => {
    redisState.configured = false;
    await savePushToken({ token: "device-token-2", platform: "ios", districtSlug: "jinja" });

    const slugs = await listDistrictSlugsWithPushTokens();
    expect(slugs).toContain("jinja");
  });

  it("removes a district from the Redis index once its last token is removed", async () => {
    redisState.configured = true;
    await savePushToken({ token: "device-token-3", platform: "android", districtSlug: "gulu" });
    await removePushToken("device-token-3");

    resetPushStoreForTests();
    const slugs = await listDistrictSlugsWithPushTokens();
    expect(slugs).not.toContain("gulu");
  });

  it("moves a district's index entry when a token re-registers to a new district", async () => {
    redisState.configured = true;
    await savePushToken({ token: "device-token-4", platform: "android", districtSlug: "mbale" });
    await savePushToken({ token: "device-token-4", platform: "android", districtSlug: "arua" });

    resetPushStoreForTests();
    const slugs = await listDistrictSlugsWithPushTokens();
    expect(slugs).toContain("arua");
    expect(slugs).not.toContain("mbale");
  });
});
