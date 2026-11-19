import { describe, expect, it, vi } from "vitest";

const { fetchMetarMock } = vi.hoisted(() => ({
  fetchMetarMock: vi.fn(),
}));

vi.mock("@/lib/weather/metar", () => ({
  fetchMetar: fetchMetarMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/weather/metar", () => {
  // Runs before the success case below: the route uses a single global
  // cache key with no per-request variation, so a prior success would
  // otherwise let the in-memory cache serve stale data instead of
  // surfacing this failure.
  it("returns 503 when the upstream feed fails", async () => {
    fetchMetarMock.mockRejectedValue(new Error("down"));
    const res = await GET(new Request("http://localhost/api/v1/weather/metar"));
    expect(res.status).toBe(503);
  });

  it("returns live reports for the configured airports", async () => {
    fetchMetarMock.mockResolvedValue([
      { icaoId: "HUEN", name: "Entebbe Intl, C, UG", tempC: 27, flightCategory: "VFR" },
    ]);

    const res = await GET(new Request("http://localhost/api/v1/weather/metar"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reports).toHaveLength(1);
    expect(body.data.reports[0].icaoId).toBe("HUEN");
  });
});
