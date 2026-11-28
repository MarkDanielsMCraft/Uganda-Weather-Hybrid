import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADVISOR_STRUCTURED_OUTPUT_SCHEMA,
  deriveSafetyVerdict,
  executeAdvisorToolCall,
  isMultiLocationQuery,
  parseAgentStructuredDirectives,
  parseStructuredAdvisorJson,
  UGANDA_WEATHER_TOOL,
} from "./advisor-tools";
import type { WeatherBundle } from "@/types/weather";

function makeBundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  return {
    district: { slug: "kampala", name: "Kampala", region: "central", lat: 0.3476, lon: 32.5825 },
    temperature: { celsius: 26, feelsLike: 27 },
    condition: { code: 1003, text: "Partly cloudy", icon: "" },
    humidity: 68,
    wind: { speedKph: 12, gustKph: 18, direction: "SE", degree: 135 },
    precipitation: { chance: 20, mm: 0 },
    daily: { high: 28, low: 19 },
    isDay: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as WeatherBundle;
}

describe("advisor-tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares the get_uganda_district_weather function tool", () => {
    expect(UGANDA_WEATHER_TOOL.functionDeclarations?.[0]?.name).toBe("get_uganda_district_weather");
  });

  it("executes get_uganda_district_weather against the live district API", async () => {
    const mbarara = makeBundle({
      district: {
        slug: "mbarara-city",
        name: "Mbarara City",
        region: "western",
      } as unknown as WeatherBundle["district"],
      precipitation: { chance: 80, mm: 4.2 },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mbarara }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const out = await executeAdvisorToolCall(
      { name: "get_uganda_district_weather", args: { district: "Mbarara" } },
      true,
    );
    expect(out).toMatchObject({
      district: "Mbarara City",
      rainChancePercent: 80,
      cached: false,
    });
  });

  it("derives Go, Caution, and Wait safety verdicts accurately and skips greetings", () => {
    expect(deriveSafetyVerdict(makeBundle(), "Clear skies all morning for drying maize.")?.level).toBe("go");
    expect(
      deriveSafetyVerdict(makeBundle({ precipitation: { chance: 45, mm: 1 } }), "Possible showers later.")?.level,
    ).toBe("caution");
    expect(
      deriveSafetyVerdict(makeBundle({ precipitation: { chance: 85, mm: 8 } }), "It is not safe to dry crops right now.")?.level,
    ).toBe("wait");
    expect(
      deriveSafetyVerdict(
        makeBundle({ precipitation: { chance: 86, mm: 6 } }),
        "Hello! I am doing well, thank you. How can I help you today?",
      ),
    ).toBeUndefined();
  });

  it("never contradicts a low-risk night reply even when full-day rain chance was 82%", () => {
    const pallisaNight = makeBundle({
      precipitation: { chance: 82, mm: 0 },
      hourly: [
        { time: "21:00", label: "9 PM", temp: 25, icon: "", kind: "hour", rainChance: 15 },
        { time: "22:00", label: "10 PM", temp: 24, icon: "", kind: "hour", rainChance: 22 },
      ],
    });
    const reply =
      "There is a low risk of heavy rain or storms tonight in Pallisa District. Rain chances are between 12 and 27 percent over the next few hours. However, lightning remains a known hazard in this area, so stay indoors if any unexpected localized showers develop.";
    const verdict = deriveSafetyVerdict(pallisaNight, reply);
    expect(verdict?.level).not.toBe("wait");
  });

  it("parses agent-driven [VERDICT: ...] and [FOLLOWUPS: ...] tags and strips them from visible text", () => {
    const raw =
      "Low storm risk tonight in Pallisa District with rain between 12% and 27%.\n[VERDICT: go | Low storm risk tonight]\n[FOLLOWUPS: Best hours for drying crops tomorrow? | How is wind speed tomorrow afternoon?]";
    const parsed = parseAgentStructuredDirectives(raw);
    expect(parsed.cleanText).toBe(
      "Low storm risk tonight in Pallisa District with rain between 12% and 27%.",
    );
    expect(parsed.verdict).toEqual({
      level: "go",
      labelEn: "Low storm risk tonight",
      labelLg: "Low storm risk tonight",
      dynamicLabel: "Low storm risk tonight",
    });
    expect(parsed.followUps).toEqual([
      "Best hours for drying crops tomorrow?",
      "How is wind speed tomorrow afternoon?",
    ]);
  });

  it("strips misspelled or multiline [FOLLOWOPS: ...] and Luganda [EBIBUUZO: ...] directives so internal tags never leak", () => {
    const raw =
      "Bikuume mu kifo ekikalu obitereke obulungi.\n\n[FOLLOWOPS: Nnyinza okufuuyira ebirime ddi leero? |\nEbika by'ebirime ki ebyetaaga okukuumibwa ku nkuba eno?]";
    const parsed = parseAgentStructuredDirectives(raw);
    expect(parsed.cleanText).toBe("Bikuume mu kifo ekikalu obitereke obulungi.");
    expect(parsed.cleanText).not.toContain("FOLLOW");
    expect(parsed.followUps).toEqual([
      "Nnyinza okufuuyira ebirime ddi leero?",
      "Ebika by'ebirime ki ebyetaaga okukuumibwa ku nkuba eno?",
    ]);

    const rawLgTag =
      "Enkya enjuba evaayo ku ssaawa 12:34 ezokumakya.\n[OKUSALAWO: bulungi | Obudde bulungi okwanika]\n[EBIBUUZO: Enkuba esuubirwa ssaawa mmeka? | Empewo ejja kuba ya maanyi gatya?]";
    const parsedLgTag = parseAgentStructuredDirectives(rawLgTag);
    expect(parsedLgTag.cleanText).toBe("Enkya enjuba evaayo ku ssaawa 12:34 ezokumakya.");
    expect(parsedLgTag.verdict?.level).toBe("go");
    expect(parsedLgTag.followUps).toEqual([
      "Enkuba esuubirwa ssaawa mmeka?",
      "Empewo ejja kuba ya maanyi gatya?",
    ]);
  });

  it("skips verdict on data-source attribution replies and [VERDICT: none]", () => {
    const highRainBundle = makeBundle({ precipitation: { chance: 88, mm: 5 } });
    expect(
      deriveSafetyVerdict(
        highRainBundle,
        "This forecast comes from the Open-Meteo live meteorological feed. Uganda Weather is not an official UNMA service.",
      ),
    ).toBeUndefined();
    expect(
      deriveSafetyVerdict(
        highRainBundle,
        "Here is where the data comes from.\n[VERDICT: none]",
      ),
    ).toBeUndefined();
    expect(
      parseAgentStructuredDirectives(
        "The photo shows a weather app interface for Kampala City, but you are currently asking about Pallisa District. Because the screenshot is from a different district and shows an older time, it does not match your current weather.\n[VERDICT: caution | Nighttime drizzle and humidity]",
      ).verdict,
    ).toBeUndefined();
  });

  it("detects multi-district comparison and route queries", () => {
    expect(isMultiLocationQuery("Compare rain in Gulu and Mbarara")).toBe(true);
    expect(isMultiLocationQuery("Is it safe to travel from Kampala to Jinja?")).toBe(true);
    expect(isMultiLocationQuery("Will it rain in Kampala tonight?")).toBe(false);
  });

  it("exposes a valid Firebase AI Logic Schema.object and parses structured JSON verdicts cleanly", () => {
    expect(ADVISOR_STRUCTURED_OUTPUT_SCHEMA).toBeDefined();
    const parsed = parseStructuredAdvisorJson(
      JSON.stringify({
        advisoryText: "Dry morning skies until 1 pm for sun drying beans.",
        verdictLevel: "go",
        verdictLabel: "Good drying window",
        followUps: ["When does afternoon rain start?", "What about tomorrow morning?"],
      }),
    );
    expect(parsed).toEqual({
      advisoryText: "Dry morning skies until 1 pm for sun drying beans.",
      verdict: {
        level: "go",
        labelEn: "Good drying window",
        labelLg: "Good drying window",
      },
      verdictExplicitlyNone: false,
      followUps: ["When does afternoon rain start?", "What about tomorrow morning?"],
    });
    expect(parseStructuredAdvisorJson("not json")).toBeNull();
  });
});
