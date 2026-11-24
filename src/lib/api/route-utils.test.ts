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
