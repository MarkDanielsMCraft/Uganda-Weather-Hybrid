import { describe, expect, it } from "vitest";
import { buildSavedForecastBriefing } from "@/lib/ai/offline-briefing";
import { makeHourlyPoints, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import type { WeatherAlert } from "@/types/weather";

function withRain(chances: number[]) {
  return makeHourlyPoints(chances.length).map((point, index) => ({
    ...point,
    rainChance: chances[index],
  }));
}

describe("buildSavedForecastBriefing", () => {
  it("gives a wait verdict and keeps crops covered when rain is very likely soon", () => {
    const weather = makeWeatherBundle({ hourly: withRain([20, 40, 75, 80, 60, 30, 10, 10]) });

    const result = buildSavedForecastBriefing({ weather, audience: "farmer", language: "en" });

    expect(result.verdict.level).toBe("wait");
    expect(result.text).toContain("80% at 3:00");
    expect(result.text).toContain("Do not dry crops outside now");
    expect(result.text).toContain("without AI");
  });

  it("gives a go verdict when rain chances stay low and wind is light", () => {
    const weather = makeWeatherBundle({ hourly: withRain([5, 10, 10, 5, 0, 0, 0, 0]) });

    const result = buildSavedForecastBriefing({ weather, audience: "fisher", language: "en" });

    expect(result.verdict.level).toBe("go");
    expect(result.text).toContain("The lake looks calm");
  });

  it("uses wind alone to raise the risk for fishers", () => {
    const weather = makeWeatherBundle({
      hourly: withRain([0, 0, 0, 0, 0, 0, 0, 0]),
      wind: { speedKph: 40, gustKph: 55, direction: "E", degree: 90 },
    });

    const result = buildSavedForecastBriefing({ weather, audience: "fisher", language: "en" });

    expect(result.verdict.level).toBe("wait");
    expect(result.text).toContain("Small boats should stay on shore");
    expect(result.text).toContain("gusts up to 55 km/h");
  });

  it("ignores rain after the next six hours when choosing the verdict", () => {
    const weather = makeWeatherBundle({
      hourly: withRain([5, 5, 5, 5, 5, 5, 5, 90, 90, 90]),
    });

    const result = buildSavedForecastBriefing({ weather, audience: "general", language: "en" });

    expect(result.verdict.level).toBe("go");
    expect(result.text).toContain("90% at 7:00");
  });

  it("says right now instead of at Now when the peak is the current hour", () => {
    const weather = makeWeatherBundle({ hourly: withRain([60, 10, 10, 10, 10, 10, 10, 10]) });

    const result = buildSavedForecastBriefing({ weather, audience: "general", language: "en" });

    expect(result.text).toContain("60% right now");
    expect(result.text).not.toContain("at Now");
  });

  it("falls back to the daily rain chance when no hourly chances exist", () => {
    const weather = makeWeatherBundle({ precipitation: { mm: 0, chance: 40 } });

    const result = buildSavedForecastBriefing({ weather, audience: "general", language: "en" });

    expect(result.verdict.level).toBe("caution");
    expect(result.text).toContain("Chance of rain today: 40%");
  });

  it("lists active warnings from the saved forecast", () => {
    const alert: WeatherAlert = {
      id: "a1",
      title: "Heavy rain warning",
      description: "Heavy rain expected.",
      severity: "warning" as WeatherAlert["severity"],
      source: "UNMA",
      issuedAt: "2026-11-24T06:00:00Z",
    };
    const weather = makeWeatherBundle({ alerts: [alert] });

    const result = buildSavedForecastBriefing({ weather, audience: "general", language: "en" });

    expect(result.text).toContain("Active warning: Heavy rain warning.");
  });

  it("writes the summary in Luganda with the saved forecast note", () => {
    const weather = makeWeatherBundle({ hourly: withRain([20, 40, 75, 80, 60, 30, 10, 10]) });

    const result = buildSavedForecastBriefing({
      weather,
      audience: "farmer",
      language: "lg",
      answeringCustomQuestion: true,
    });

    expect(result.verdict.labelLg).toBe("Linda / Obulabe bwa maanyi");
    expect(result.text).toContain("Toli ku mutimbagano kati.");
    expect(result.text).toContain("Omukisa gw'enkuba 80%");
    expect(result.text).toContain("Toyanika birime wabweru kati.");
    expect(result.text).toContain("tebukozesezza AI");
    expect(result.text).not.toMatch(/without AI|Rain|Wind/);
  });
});
