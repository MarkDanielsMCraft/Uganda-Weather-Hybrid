import { describe, expect, it, vi } from "vitest";

const districtSlugs = ["kampala", "gulu"];

const getWeatherBundleForDistrict = vi.fn();
const dispatchStormAlert = vi.fn(async () => ({ targeted: 1, dryRun: true }));

vi.mock("@/lib/push/store", () => ({
  listDistrictSlugsWithPushTokens: async () => districtSlugs,
}));

vi.mock("@/lib/cache", () => ({
  getCached: async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => ({
    data: await fetcher(),
    stale: false,
  }),
}));

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => null,
  redisGetJson: async () => null,
  redisSet: async () => undefined,
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict,
}));

vi.mock("@/lib/push/dispatch", () => ({ dispatchStormAlert }));

vi.mock("@/lib/alerts", () => ({
  getAlertsForDistrict: async () => [
    {
      id: "storm-1",
      title: "Thunderstorm Warning",
      description: "Seek shelter.",
      severity: "warning",
      source: "Test",
      issuedAt: new Date().toISOString(),
    },
  ],
}));

const { dispatchPendingSevereAlerts } = await import("./alert-dispatch");

describe("severe alert dispatch", () => {
  it("keeps dispatching for later districts when one district has no weather", async () => {
    // The provider now throws rather than inventing numbers when every
    // upstream provider is down. Without a per-district guard that throw
    // escapes the loop, and every district queued behind the failing one
    // silently loses its severe weather push.
    getWeatherBundleForDistrict.mockReset();
    dispatchStormAlert.mockClear();
    getWeatherBundleForDistrict
      .mockRejectedValueOnce(new Error("Every weather provider failed for kampala"))
      .mockResolvedValueOnce({ alerts: [] });

    const result = await dispatchPendingSevereAlerts({ dryRun: true });

    expect(result.dispatched.map((entry) => entry.districtSlug)).toEqual(["gulu"]);
    expect(dispatchStormAlert).toHaveBeenCalledTimes(1);
  });
});
