import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchMetar } from "./metar";

describe("fetchMetar", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses a live-shaped METAR response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            icaoId: "HUEN",
            receiptTime: "2026-07-10T08:44:04.796Z",
            reportTime: "2026-07-10T08:30:00.000Z",
            temp: 27,
            dewp: 19,
            wdir: 190,
            wspd: 6,
            visib: "6+",
            altim: 1019,
            fltCat: "VFR",
            rawOb: "METAR HUEN 100830Z 19006KT 9999 FEW025 FEW027CB 27/19 Q1019",
            name: "Entebbe Intl, C, UG",
            clouds: [{ cover: "FEW", base: 2500 }],
          },
        ]),
        { status: 200 },
      ),
    );

    const reports = await fetchMetar(["HUEN"]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      icaoId: "HUEN",
      tempC: 27,
      dewpointC: 19,
      windSpeedKt: 6,
      flightCategory: "VFR",
    });
    expect(reports[0].clouds).toEqual([{ cover: "FEW", base: 2500 }]);
  });

  it("omits stations with no active observation rather than fabricating one", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const reports = await fetchMetar(["HUAR"]);
    expect(reports).toEqual([]);
  });

  it("returns an empty array without calling fetch when given no ids", async () => {
    global.fetch = vi.fn();
    const reports = await fetchMetar([]);
    expect(reports).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws when the upstream request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    await expect(fetchMetar(["HUEN"])).rejects.toThrow();
  });
});
