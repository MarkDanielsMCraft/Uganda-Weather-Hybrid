import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal("fetch", mockFetch);

const { searchOfficialLocalities } = await import("./uganda-localities");

describe("uganda-localities v1 API parser", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("parses v1 nested path structure and returns valid place hits", async () => {
    mockFetch.mockImplementation((url: URL | string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/villages")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "7224",
                  type: "villages",
                  attributes: {
                    name: "KYAZIIZA",
                    slug: "kyaziiza-kyaziiza",
                    displayName: "Kyaziiza",
                    path: [
                      { type: "regions", id: "1", name: "CENTRAL" },
                      { type: "sub-regions", id: "1", name: "BUGANDA SOUTH" },
                      { type: "districts", id: "17", name: "BUKOMANSIMBI" },
                      { type: "counties", id: "56", name: "BUKOMANSIMBI NORTH COUNTY" },
                      { type: "sub-counties", id: "226", name: "BUKANGO" },
                      { type: "parishes", id: "1133", name: "KYAZIIZA" },
                    ],
                  },
                },
              ],
            }),
        });
      }

      if (urlStr.includes("/parishes")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }

      // Nominatim reverse or search geocode mock
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ lat: "0.15", lon: "31.75", class: "place", type: "village" }]),
      });
    });

    const results = await searchOfficialLocalities("Kyaziiza", 5);
    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];
    expect(hit.name).toBe("Kyaziiza");
    expect(hit.key).toBe("village-7224");
    expect(hit.parentDistrictSlug).toBe("bukomansimbi");
  });
});
