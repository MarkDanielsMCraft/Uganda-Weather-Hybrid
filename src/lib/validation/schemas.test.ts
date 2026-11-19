import { describe, expect, it } from "vitest";
import {
  districtQuerySchema,
  forecastQuerySchema,
  lugandaFeedbackSchema,
  placeWeatherQuerySchema,
  pushDispatchSchema,
  pushRegisterSchema,
  reverseLocationQuerySchema,
  searchQuerySchema,
} from "./schemas";

describe("districtQuerySchema", () => {
  it("accepts a lowercase slug", () => {
    expect(districtQuerySchema.safeParse({ district: "kampala" }).success).toBe(true);
  });

  it("rejects uppercase, spaces, or empty values", () => {
    expect(districtQuerySchema.safeParse({ district: "Kampala" }).success).toBe(false);
    expect(districtQuerySchema.safeParse({ district: "kam pala" }).success).toBe(false);
    expect(districtQuerySchema.safeParse({ district: "" }).success).toBe(false);
  });

  it("rejects a value that isn't a real single-letter slug (min length 2)", () => {
    expect(districtQuerySchema.safeParse({ district: "k" }).success).toBe(false);
  });
});

describe("placeWeatherQuerySchema", () => {
  const valid = { place: "kyaziiza", name: "Kyaziiza", lat: "0.34", lon: "32.58" };

  it("accepts coordinates within Uganda's bounding box (coerced from query strings)", () => {
    const result = placeWeatherQuerySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lat).toBe(0.34);
      expect(result.data.lon).toBe(32.58);
    }
  });

  it("rejects coordinates outside Uganda's bounding box", () => {
    expect(placeWeatherQuerySchema.safeParse({ ...valid, lat: "45" }).success).toBe(false);
    expect(placeWeatherQuerySchema.safeParse({ ...valid, lon: "10" }).success).toBe(false);
  });

  it("rejects a non-numeric coordinate", () => {
    expect(placeWeatherQuerySchema.safeParse({ ...valid, lat: "not-a-number" }).success).toBe(false);
  });

  it("rejects blank or whitespace-only coordinates instead of coercing to 0", () => {
    expect(placeWeatherQuerySchema.safeParse({ ...valid, lat: "" }).success).toBe(false);
    expect(placeWeatherQuerySchema.safeParse({ ...valid, lat: "   " }).success).toBe(false);
    expect(reverseLocationQuerySchema.safeParse({ lat: "", lon: "32.58" }).success).toBe(false);
    expect(reverseLocationQuerySchema.safeParse({ lat: "   ", lon: "32.58" }).success).toBe(false);
  });
});

describe("forecastQuerySchema", () => {
  it("allows an empty query (all fields optional)", () => {
    expect(forecastQuerySchema.safeParse({}).success).toBe(true);
  });

  it("clamps days to the 1-14 range", () => {
    expect(forecastQuerySchema.safeParse({ days: "14" }).success).toBe(true);
    expect(forecastQuerySchema.safeParse({ days: "15" }).success).toBe(false);
    expect(forecastQuerySchema.safeParse({ days: "0" }).success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("requires at least 2 characters", () => {
    expect(searchQuerySchema.safeParse({ q: "k" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "ka" }).success).toBe(true);
  });
});

describe("reverseLocationQuerySchema", () => {
  it("requires both lat and lon within Uganda's bounds", () => {
    expect(reverseLocationQuerySchema.safeParse({ lat: "0.3", lon: "32.5" }).success).toBe(true);
    expect(reverseLocationQuerySchema.safeParse({ lat: "0.3" }).success).toBe(false);
  });
});

describe("pushRegisterSchema", () => {
  it("requires a sufficiently long token and a valid platform", () => {
    const result = pushRegisterSchema.safeParse({
      token: "a".repeat(32),
      platform: "android",
      districtSlug: "kampala",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short token or an invalid platform", () => {
    expect(
      pushRegisterSchema.safeParse({ token: "short", platform: "android", districtSlug: "kampala" }).success,
    ).toBe(false);
    expect(
      pushRegisterSchema.safeParse({ token: "a".repeat(32), platform: "windows", districtSlug: "kampala" })
        .success,
    ).toBe(false);
  });
});

describe("pushDispatchSchema", () => {
  it("accepts a well-formed storm alert dispatch payload", () => {
    const result = pushDispatchSchema.safeParse({
      districtSlug: "kampala",
      title: "Storm Warning",
      body: "Heavy rain expected this evening.",
      dryRun: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a title or body that's too short to be meaningful", () => {
    expect(
      pushDispatchSchema.safeParse({ districtSlug: "kampala", title: "Hi", body: "ok" }).success,
    ).toBe(false);
  });
});

describe("lugandaFeedbackSchema", () => {
  it("accepts a valid Luganda beta issue report with optional fields blank", () => {
    const result = lugandaFeedbackSchema.safeParse({
      category: "grammar",
      currentText: "  ",
      suggestedText: "",
      details: "Ekigambo kino kitera okuwandiikibwa n'ennukuta bbiri.",
      pageOrSection: "Kampala / Kati",
      contactEmail: "  ",
      website: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentText).toBeUndefined();
      expect(result.data.contactEmail).toBeUndefined();
    }
  });

  it("rejects short details or malformed contactEmail", () => {
    expect(
      lugandaFeedbackSchema.safeParse({
        category: "translation",
        details: "bad",
      }).success,
    ).toBe(false);
    expect(
      lugandaFeedbackSchema.safeParse({
        category: "translation",
        details: "Ensobi mu kigambo kino",
        contactEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });
});
