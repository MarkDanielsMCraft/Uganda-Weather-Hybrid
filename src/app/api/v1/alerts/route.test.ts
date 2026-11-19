import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock, getAlertsForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
  getAlertsForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

// Mocked so the route test never makes a real network call to the UNMA
// CAP feed — that path already has its own dedicated tests.
vi.mock("@/lib/alerts", () => ({
  getAlertsForDistrict: getAlertsForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/alerts", () => {
  it("merges provider alerts through getAlertsForDistrict and returns them", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "kitgum", name: "Kitgum" }) }),
    );
    getAlertsForDistrictMock.mockResolvedValue([
      {
        id: "1",
        title: "Flood Warning",
        description: "Heavy rain expected.",
        severity: "warning",
        source: "UNMA",
        issuedAt: new Date().toISOString(),
      },
    ]);

    const res = await GET(new Request("http://localhost/api/v1/alerts?district=kitgum"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alerts).toHaveLength(1);
    expect(body.data.alerts[0].title).toBe("Flood Warning");
  });

  it("returns an empty array, not an error, when there are no active alerts", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "hoima", name: "Hoima" }) }),
    );
    getAlertsForDistrictMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/v1/alerts?district=hoima"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alerts).toEqual([]);
  });

  it("rejects a missing district with 400", async () => {
    const res = await GET(new Request("http://localhost/api/v1/alerts"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown district", async () => {
    const res = await GET(new Request("http://localhost/api/v1/alerts?district=nowhere"));
    expect(res.status).toBe(404);
  });

  it("returns 503 when alert aggregation fails", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "moroto", name: "Moroto" }) }),
    );
    getAlertsForDistrictMock.mockRejectedValue(new Error("UNMA feed down"));

    const res = await GET(new Request("http://localhost/api/v1/alerts?district=moroto"));
    expect(res.status).toBe(503);
  });
});
