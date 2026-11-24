import { describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getWeatherBundleForDistrictMock } = vi.hoisted(() => ({
  getWeatherBundleForDistrictMock: vi.fn(),
}));

vi.mock("@/lib/weather/provider", () => ({
  getWeatherBundleForDistrict: getWeatherBundleForDistrictMock,
}));

const { GET } = await import("./route");

describe("GET /api/v1/agriculture/advisory", () => {
  it("returns crop advisories scoped to the district's agro-zone", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "abim", name: "Abim", agroZone: "karamoja" }),
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/agriculture/advisory?district=abim"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.district.agroZone).toBe("karamoja");
    expect(body.data.crops).toEqual(["Sorghum", "Millet", "Cowpeas"]);
    // Regression check for the crop-zone relevance bug: Karamoja must get
    // advisories for the crops it actually grows (sorghum/millet/cowpeas),
    // not a Coffee/Maize/etc. advisory that doesn't apply there.
    const ids = body.data.cropAdvisories.map((c: { id: string }) => c.id).sort();
    expect(ids).toEqual(["cowpeas", "millet", "sorghum"]);
  });

  it("includes a 7-day rain-chance outlook", async () => {
    getWeatherBundleForDistrictMock.mockResolvedValue(
      makeWeatherBundle({
        district: makeDistrict({ slug: "kasese", name: "Kasese" }),
        dailyForecast: Array.from({ length: 10 }, (_, i) => ({
          day: `Day ${i}`,
          high: 27,
          low: 17,
          icon: "",
          isToday: i === 0,
          rainChance: 40 + i,
        })),
      }),
    );

    const res = await GET(new Request("http://localhost/api/v1/agriculture/advisory?district=kasese"));
    const body = await res.json();
    expect(body.data.weeklyRainChance).toHaveLength(7);
    expect(body.data.weeklyRainChance[0].rainChance).toBe(40);
  });

  it("returns 404 for an unknown district", async () => {
    const res = await GET(new Request("http://localhost/api/v1/agriculture/advisory?district=nowhere"));
    expect(res.status).toBe(404);
  });
});

describe("farming advice for shared places", () => {
  it("shows each visitor their own place name, never the name the first visitor sent", async () => {
    getWeatherBundleForDistrictMock.mockImplementation(async (district: { name: string }) =>
      makeWeatherBundle({ district: makeDistrict({ slug: "place-x", name: district.name }) }),
    );
    const ask = (name: string) =>
      GET(new Request(`http://localhost/api/v1/agriculture/advisory?place=village-77&name=${name}&lat=0.4711&lon=32.5511`));

    await ask("Planted%20Name");
    const second = await (await ask("Kireka")).json();
    const text = JSON.stringify(second.data);
    expect(second.data.district.name).toBe("Kireka");
    expect(text).not.toContain("Planted Name");
  });
});
