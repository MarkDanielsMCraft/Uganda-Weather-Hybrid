import { beforeEach, describe, expect, it, vi } from "vitest";

const { prefetchDistrictWeatherMock } = vi.hoisted(() => ({
  prefetchDistrictWeatherMock: vi.fn(),
}));

vi.mock("@/lib/weather/prefetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/weather/prefetch")>(
    "@/lib/weather/prefetch",
  );
  return { ...actual, prefetchDistrictWeather: prefetchDistrictWeatherMock };
});

const { GET } = await import("./route");
const { PREFETCH_PRIORITY_SLUGS } = await import("@/lib/weather/prefetch");

function authedRequest(url: string) {
  return new Request(url, { headers: { authorization: "Bearer test-secret" } });
}

describe("GET /api/v1/cron/prefetch-weather", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    prefetchDistrictWeatherMock.mockResolvedValue({
      requested: 0,
      cached: 0,
      refreshed: 0,
      errors: [],
      notFound: [],
      results: [],
    });
  });

  it("rejects requests without valid cron credentials", async () => {
    const res = await GET(new Request("http://localhost/api/v1/cron/prefetch-weather"));
    expect(res.status).toBe(401);
  });

  it("reports the requested page size for mode=all, even when the last page is partial", async () => {
    // Regression test: this used to report `slugs.length` for both
    // branches of the mode ternary, so a partial last page (e.g. offset
    // 100, limit 100 against 152 districts -> only 52 slugs) silently
    // under-reported the configured limit as 52 instead of 100.
    const res = await GET(
      authedRequest(
        "http://localhost/api/v1/cron/prefetch-weather?mode=all&offset=100&limit=100",
      ),
    );
    const body = await res.json();
    expect(body.data.mode).toBe("all");
    expect(body.data.offset).toBe(100);
    expect(body.data.limit).toBe(100);
  });

  it("reports the priority list's own length as the limit in priority mode", async () => {
    const res = await GET(authedRequest("http://localhost/api/v1/cron/prefetch-weather"));
    const body = await res.json();
    expect(body.data.mode).toBe("priority");
    expect(body.data.limit).toBe(PREFETCH_PRIORITY_SLUGS.length);
  });
});
