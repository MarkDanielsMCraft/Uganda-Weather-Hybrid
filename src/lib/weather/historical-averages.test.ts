import { afterEach, describe, expect, it, vi } from "vitest";
import { compareHighToNormal, fetchHistoricalNormal } from "./historical-averages";
import { makeDistrict } from "@/lib/test-fixtures/weather-bundle";

function visualCrossingPayload({
  tempmax,
  normalMean,
}: {
  tempmax?: number;
  normalMean?: number;
}) {
  return {
    days: [
      {
        // Present in the real response and deliberately ignored: see the
        // regression test below for why.
        ...(tempmax === undefined ? {} : { tempmax }),
        ...(normalMean === undefined
          ? {}
          : { normal: { tempmax: [normalMean - 4, normalMean, normalMean + 4] } }),
      },
    ],
  };
}

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

const district = makeDistrict({ slug: "kampala" });

describe("fetchHistoricalNormal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when no key is configured, rather than inventing a normal", async () => {
    vi.stubEnv("VISUAL_CROSSING_API_KEY", "");
    expect(await fetchHistoricalNormal(district)).toBeNull();
  });

  it("reads the mean of normal.tempmax, not its min or max", async () => {
    vi.stubEnv("VISUAL_CROSSING_API_KEY", "test-key");
    stubFetch(visualCrossingPayload({ normalMean: 27 }));

    expect(await fetchHistoricalNormal(district)).toEqual({ normalHigh: 27 });
  });

  it("ignores the response's own tempmax entirely", async () => {
    // The regression this file exists for. tempmax was previously taken as
    // today's actual high, and in production Visual Crossing returned it
    // equal to the normal for every district tested, so the tile compared
    // the normal against itself and always read "0 at average". A payload
    // where the two differ wildly must still yield only the normal.
    vi.stubEnv("VISUAL_CROSSING_API_KEY", "test-key");
    stubFetch(visualCrossingPayload({ tempmax: 99, normalMean: 27 }));

    const normal = await fetchHistoricalNormal(district);

    expect(normal).toEqual({ normalHigh: 27 });
    expect(JSON.stringify(normal)).not.toContain("99");
  });

  it("returns null when the response carries no normal", async () => {
    vi.stubEnv("VISUAL_CROSSING_API_KEY", "test-key");
    stubFetch(visualCrossingPayload({ tempmax: 30 }));

    expect(await fetchHistoricalNormal(district)).toBeNull();
  });

  it("returns null on a non-OK response instead of throwing", async () => {
    vi.stubEnv("VISUAL_CROSSING_API_KEY", "test-key");
    stubFetch({}, 429);

    expect(await fetchHistoricalNormal(district)).toBeNull();
  });
});

describe("compareHighToNormal", () => {
  it("reports a warmer day as a positive difference", () => {
    expect(compareHighToNormal(30, { normalHigh: 27 })).toEqual({
      actualHigh: 30,
      normalHigh: 27,
      diff: 3,
    });
  });

  it("reports a cooler day as a negative difference", () => {
    expect(compareHighToNormal(24, { normalHigh: 27 })).toEqual({
      actualHigh: 24,
      normalHigh: 27,
      diff: -3,
    });
  });

  it("still reports zero when today genuinely matches the normal", () => {
    // Zero is a legitimate answer. What was wrong before was that it was
    // the only answer, because both numbers came from the same field.
    expect(compareHighToNormal(27, { normalHigh: 27 }).diff).toBe(0);
  });

  it("takes today's high from the caller, so the two numbers cannot be the same source", () => {
    const normal = { normalHigh: 27 };
    expect(compareHighToNormal(31, normal).diff).toBe(4);
    expect(compareHighToNormal(22, normal).diff).toBe(-5);
  });
});
