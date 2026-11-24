import { describe, expect, it, vi } from "vitest";
import { rejectCrossSiteRequest } from "@/lib/api/route-utils";

function post(headers: Record<string, string>) {
  return new Request("https://hybrid.uganda-weather.com/api/v1/voice/speak", {
    method: "POST",
    headers,
  });
}

describe("rejectCrossSiteRequest", () => {
  it("allows requests the browser marks as same origin or same site", () => {
    expect(rejectCrossSiteRequest(post({ "sec-fetch-site": "same-origin" }), "voice")).toBeNull();
    expect(rejectCrossSiteRequest(post({ "sec-fetch-site": "same-site" }), "voice")).toBeNull();
  });

  it("allows older browsers whose Origin matches the host", () => {
    const request = post({
      origin: "https://hybrid.uganda-weather.com",
      host: "hybrid.uganda-weather.com",
    });
    expect(rejectCrossSiteRequest(request, "voice")).toBeNull();
  });

  it("blocks requests from other websites with a single warning line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = rejectCrossSiteRequest(
      post({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }),
      "voice",
    );
    expect(response?.status).toBe(403);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("code=CROSS_SITE site=cross-site"));
    warn.mockRestore();
  });

  it("blocks requests with no browser origin signals at all", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(rejectCrossSiteRequest(post({}), "voice")?.status).toBe(403);
    warn.mockRestore();
  });

  it("blocks a mismatched Origin when Sec-Fetch-Site is absent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = post({ origin: "https://evil.example", host: "hybrid.uganda-weather.com" });
    expect(rejectCrossSiteRequest(request, "voice")?.status).toBe(403);
    warn.mockRestore();
  });
});

describe("enforceRateLimit", () => {
  function apiGet(path: string, ip: string) {
    return new Request(`https://hybrid.uganda-weather.com${path}`, {
      headers: { "x-forwarded-for": ip },
    });
  }

  it("gives each route its own bucket so busy pages do not block search", async () => {
    const { enforceRateLimit } = await import("@/lib/api/route-utils");
    vi.stubEnv("API_RATE_LIMIT_PER_MINUTE", "30");
    for (let i = 0; i < 30; i += 1) {
      expect(enforceRateLimit(apiGet("/api/v1/weather/current", "10.9.0.1"))).not.toBeInstanceOf(Response);
    }
    expect(enforceRateLimit(apiGet("/api/v1/weather/current", "10.9.0.1"))).toBeInstanceOf(Response);
    expect(enforceRateLimit(apiGet("/api/v1/locations/search", "10.9.0.1"))).not.toBeInstanceOf(Response);
    vi.unstubAllEnvs();
  });

  it("allows 240 requests a minute by default for people sharing one network address", async () => {
    const { enforceRateLimit } = await import("@/lib/api/route-utils");
    for (let i = 0; i < 240; i += 1) {
      expect(enforceRateLimit(apiGet("/api/v1/alerts", "10.9.0.2"))).not.toBeInstanceOf(Response);
    }
    expect(enforceRateLimit(apiGet("/api/v1/alerts", "10.9.0.2"))).toBeInstanceOf(Response);
  });
});

describe("rate limit attacks", () => {
  it("blocks a client that rotates the district name to dodge the limit", async () => {
    const { enforceRateLimit } = await import("@/lib/api/route-utils");
    const { resetRateLimitsForTests, trackedRateLimitKeysForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    let blocked = 0;
    for (let i = 0; i < 300; i += 1) {
      const request = new Request(`https://x.test/api/v1/districts/fake-${i}`, {
        headers: { "x-forwarded-for": "10.9.9.9" },
      });
      if (enforceRateLimit(request) instanceof Response) blocked += 1;
    }
    expect(blocked).toBe(60);
    expect(trackedRateLimitKeysForTests()).toBe(1);
  });

  it("keeps district search in its own bucket", async () => {
    const { enforceRateLimit } = await import("@/lib/api/route-utils");
    const { resetRateLimitsForTests, trackedRateLimitKeysForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    enforceRateLimit(new Request("https://x.test/api/v1/districts/kampala", { headers: { "x-forwarded-for": "10.9.9.8" } }));
    enforceRateLimit(new Request("https://x.test/api/v1/districts/search?q=a", { headers: { "x-forwarded-for": "10.9.9.8" } }));
    expect(trackedRateLimitKeysForTests()).toBe(2);
  });

  it("ignores extra path parts so long made up paths share one bucket", async () => {
    const { enforceRateLimit } = await import("@/lib/api/route-utils");
    const { resetRateLimitsForTests, trackedRateLimitKeysForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    for (let i = 0; i < 50; i += 1) {
      enforceRateLimit(new Request(`https://x.test/api/v1/weather/current/extra-${i}/more`, { headers: { "x-forwarded-for": "10.9.9.7" } }));
    }
    expect(trackedRateLimitKeysForTests()).toBe(1);
  });
});
