import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/places/nominatim-pacer", async (original) => {
  const real = await original<typeof import("@/lib/places/nominatim-pacer")>();
  return { ...real, waitForNominatimTurn: vi.fn(async () => undefined) };
});

import { reverseGeocodeUganda } from "@/lib/places/geocode";

describe("map service refusals", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not save a rough answer after a 429, so the next lookup gets the real name", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ address: { village: "Kireka", county: "Kira", state: "Wakiso" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await reverseGeocodeUganda(0.3461, 32.6481);
    expect(first.approximate).toBe(true);
    expect(first.label).toMatch(/^Near /);

    const second = await reverseGeocodeUganda(0.3461, 32.6481);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.name).toBe("Kireka");
  });
});
