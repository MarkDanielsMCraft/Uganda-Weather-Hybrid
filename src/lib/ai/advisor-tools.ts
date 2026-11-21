import { Schema, type FunctionCall, type FunctionDeclarationsTool } from "firebase/ai";
import { getAllDistricts } from "@/lib/districts";
import { loadWeatherCache } from "@/lib/offline/weather-cache";
import type { WeatherBundle } from "@/types/weather";

export type SafetyVerdictLevel = "go" | "caution" | "wait";

export interface SafetyVerdict {
  level: SafetyVerdictLevel;
  labelEn: string;
  labelLg: string;
  dynamicLabel?: string;
}

export function isMultiLocationQuery(text: string): boolean {
  return /\b(compare|between|versus|vs\.?|route|drive\s+from|travel\s+from|going\s+from|from\s+[A-Za-z][A-Za-z'-]{2,}\s+to\s+[A-Za-z][A-Za-z'-]{2,}|both\s+districts|across\s+districts|kuva\s+e\s+\w+\s+okutuuka)\b/i.test(
    text.trim(),
  );
}

export interface ParsedAgentDirectives {
  cleanText: string;
  verdict?: SafetyVerdict;
  verdictExplicitlyNone: boolean;
  followUps: string[];
}

export function parseAgentStructuredDirectives(rawText: string): ParsedAgentDirectives {
  let verdict: SafetyVerdict | undefined;
  let verdictExplicitlyNone = false;
  const followUps: string[] = [];

  const verdictMatch = /\[\s*VERD[IA]CTS?\s*:\s*([^\]\n]+)\]/i.exec(rawText);
  if (verdictMatch && verdictMatch[1]) {
    const parts = verdictMatch[1].split("|").map((p) => p.trim());
    const rawLevel = (parts[0] ?? "").toLowerCase();
    const customLabel = parts[1]?.replace(/[\[\]]/g, "").trim();
    if (rawLevel === "none" || rawLevel === "skip" || rawLevel === "n/a") {
      verdictExplicitlyNone = true;
    } else if (rawLevel === "go" || rawLevel === "safe") {
      const label = customLabel || "Safe to go";
      verdict = {
        level: "go",
        labelEn: label,
        labelLg: customLabel || "Obudde bulungi",
        dynamicLabel: label,
      };
    } else if (rawLevel === "caution" || rawLevel === "careful") {
      const label = customLabel || "Caution";
      verdict = {
        level: "caution",
        labelEn: label,
        labelLg: customLabel || "Beera mwegendereza",
        dynamicLabel: label,
      };
    } else if (rawLevel === "wait" || rawLevel === "high risk" || rawLevel === "stop") {
      const label = customLabel || "Wait / High risk";
      verdict = {
        level: "wait",
        labelEn: label,
        labelLg: customLabel || "Linda / Obulabe bwa maanyi",
        dynamicLabel: label,
      };
    }
  }

  const followUpsMatch =
    /\[\s*FOLLOW[-_\s]?[A-Z]?PS?(?:\s+QUESTIONS?)?\s*:\s*([^\]]+)\]/i.exec(rawText) ??
    /(?:^|\n)\s*FOLLOW[-_\s]?[A-Z]?PS?(?:\s+QUESTIONS?)?\s*:\s*([^\n]+)/i.exec(rawText);
  if (followUpsMatch && followUpsMatch[1]) {
    for (const item of followUpsMatch[1].replace(/\s+/g, " ").split("|")) {
      const cleaned = item.replace(/^[-•*\d.)\s]+/, "").trim();
      if (cleaned.length >= 6 && cleaned.length <= 110 && !followUps.includes(cleaned)) {
        followUps.push(cleaned);
      }
      if (followUps.length >= 2) break;
    }
  }

  // Strip complete, misspelled, unbracketed, multiline, or partially streamed
  // internal directive blocks ([VERDICT:...], [FOLLOWUPS:...], [FOLLOWOPS:...],
  // [FOLLOWAPS:...], [FOLLOW-UP QUESTIONS:...], etc.) so internal tags never leak.
  const cleanText = rawText
    .replace(/\[\s*VERD[A-Z]{0,5}\s*:[^\]]*\]?/gi, "")
    .replace(/\[\s*FOLLOW[-_\s]?[A-Z]?PS?(?:\s+QUESTIONS?)?\s*:[^\]]*\]?/gi, "")
    .replace(/(?:^|\n)\s*\*{0,2}(?:VERD[A-Z]{0,5}|FOLLOW[-_\s]?[A-Z]?PS?(?:\s+QUESTIONS?)?)(?:\*{0,2}\s*:|:\s*\*{0,2})[^\n]*/gi, "")
    .replace(/\[\s*(?:VERD[A-Z]{0,5}|FOLL(?:OW[-_\s]?[A-Z]?PS?(?:\s+QUESTIONS?)?)?)\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Never attach a safety verdict to data-source attribution explanations,
  // polite scope refusals, or photo/screenshot location or staleness rejections.
  const isMetaOrRefusal =
    /\b(open-meteo|weatherapi|pirate weather|third party forecast|not an official unma|si mukutu mutongole|only help with uganda weather|nkola ku mbeera y'obudde|taken outside uganda|kyaggyibwa ebweru wa uganda|kyaggyibwa ebweru wa yuganda|from a different district|does not match your current weather|shows a weather app interface for|photo looks like|older photo|shows an older time)\b/i.test(
      rawText,
    );
  if (isMetaOrRefusal) {
    return {
      cleanText,
      verdict: undefined,
      verdictExplicitlyNone: true,
      followUps,
    };
  }

  return {
    cleanText,
    verdict,
    verdictExplicitlyNone,
    followUps,
  };
}

export const UGANDA_WEATHER_TOOL: FunctionDeclarationsTool = {
  functionDeclarations: [
    {
      name: "get_uganda_district_weather",
      description:
        "Fetch live current weather, rain chance, wind speed, and daily high/low for any Uganda district by name or slug. Use this when the user asks to compare districts or plan travel/routes between two Uganda districts.",
      parameters: Schema.object({
        properties: {
          district: Schema.string({
            description: "Uganda district name or slug, for example Kampala, Mbarara, Gulu, Jinja, or Entebbe.",
          }),
        },
        required: ["district"],
      }),
    },
  ],
};

function findDistrictByQuery(rawQuery: string) {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return null;
  const districts = getAllDistricts();
  return (
    districts.find(
      (d) =>
        d.slug.toLowerCase() === cleaned ||
        d.name.toLowerCase() === cleaned ||
        d.name.toLowerCase().replace(/\s+city$/i, "") === cleaned,
    ) ??
    districts.find(
      (d) =>
        d.name.toLowerCase().includes(cleaned) ||
        d.slug.toLowerCase().includes(cleaned),
    ) ??
    null
  );
}

export async function executeAdvisorToolCall(
  call: FunctionCall,
  isOnline: boolean,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  if (call.name !== "get_uganda_district_weather") {
    return { error: "Unsupported tool" };
  }

  const rawDistrict =
    typeof (call.args as { district?: unknown } | undefined)?.district === "string"
      ? (call.args as { district: string }).district
      : "";
  const district = findDistrictByQuery(rawDistrict);
  if (!district) {
    return { error: "District not found in Uganda dataset", requested: rawDistrict };
  }

  const cached = loadWeatherCache(district.slug)?.data ?? null;
  if (!isOnline) {
    if (!cached) {
      return { district: district.name, error: "No cached offline forecast available for this district" };
    }
    return summarizeBundleForTool(cached, true);
  }

  try {
    const res = await fetch(
      `/api/v1/weather/current?district=${encodeURIComponent(district.slug)}`,
      { signal },
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: WeatherBundle };
      if (json.data) {
        return summarizeBundleForTool(json.data, false);
      }
    }
  } catch {
    // Fall back to cached weather if network fails
  }

  if (cached) {
    return summarizeBundleForTool(cached, true);
  }
  return { district: district.name, error: "Forecast temporarily unavailable" };
}

function summarizeBundleForTool(bundle: WeatherBundle, cached: boolean): Record<string, unknown> {
  return {
    district: bundle.district.name,
    region: bundle.district.region,
    cached,
    temperatureC: Math.round(bundle.temperature.celsius),
    condition: bundle.condition.text,
    rainChancePercent: Math.round(bundle.precipitation.chance),
    windKph: Math.round(bundle.wind.speedKph),
    windGustKph: Math.round(bundle.wind.gustKph ?? bundle.wind.speedKph),
    humidityPercent: Math.round(bundle.humidity),
    highC: Math.round(bundle.daily.high),
    lowC: Math.round(bundle.daily.low),
  };
}

/**
 * Derives a clear visual Go / Caution / Wait safety verdict from the weather
 * telemetry and advisor text so low-literacy users can grasp risk at a glance.
 * Returns undefined for greetings, courtesies, or non-forecast meta replies.
 */
export function deriveSafetyVerdict(
  weather: WeatherBundle,
  replyText: string,
): SafetyVerdict | undefined {
  const parsed = parseAgentStructuredDirectives(replyText);
  if (parsed.verdictExplicitlyNone) {
    return undefined;
  }
  if (parsed.verdict) {
    return parsed.verdict;
  }

  const lower = parsed.cleanText.toLowerCase();

  // Never attach a safety verdict to data-source attribution explanations,
  // polite scope refusals, or photo location/staleness rejections.
  const isMetaOrRefusal =
    /\b(open-meteo|weatherapi|pirate weather|third party forecast|not an official unma|si mukutu mutongole|only help with uganda weather|nkola ku mbeera y'obudde|taken outside uganda|kyaggyibwa ebweru wa uganda|kyaggyibwa ebweru wa yuganda)\b/i.test(
      lower,
    );
  if (isMetaOrRefusal) {
    return undefined;
  }

  const hasForecastGuidance =
    /\b(rain|shower|showers|storm|storms|thunder|lightning|wind|winds|gust|gusts|dry|drying|crop|crops|farm|farming|plant|planting|spray|spraying|harvest|maize|coffee|beans|lake|boat|fish|fishing|launch|travel|road|drive|trail|hike|sun|sunny|sky|skies|cloud|cloudy|heat|uv|°c|km\/h|percent|%|enkuba|empewo|ebirime|nnyanja|okutambula|omuyaga|obudde)\b/i.test(
      lower,
    );
  if (!hasForecastGuidance) {
    return undefined;
  }

  // If the advisor's reply explicitly concludes that conditions are low risk,
  // calm, clear, or safe, never contradict the advisor's text with a full-day
  // rain percentage from earlier hours.
  const explicitWait =
    /\b(not safe|do not launch|do not dry|delay outdoor|wait until tomorrow|severe storm|dangerous|storm warning|heavy rain expected|high risk of|tekyali kya bukuumi|obulabe bwa maanyi)\b/i.test(
      lower,
    );
  const explicitLowRisk =
    !explicitWait &&
    /\b(low risk|low chance of rain|(?<!not\s)safe to|good conditions|calm night|no storm risk|clear skies|no heavy rain|tewali bulabe|obudde bulungi|buteefu)\b/i.test(
      lower,
    );
  const explicitCaution =
    /\b(caution|be careful|watch out|possible showers|cover your crops|light rain|keep covers|unexpected localized showers|mwegendereza|eyinza okutonnya)\b/i.test(
      lower,
    );

  if (explicitLowRisk) {
    if (explicitCaution) {
      return {
        level: "caution",
        labelEn: "Low risk / Stay alert",
        labelLg: "Obulabe butono / Weekenneenye",
      };
    }
    return {
      level: "go",
      labelEn: "Low risk / Safe",
      labelLg: "Tewali bulabe / Obudde bulungi",
    };
  }

  const upcomingHourPoint = Array.isArray(weather.hourly)
    ? weather.hourly.find((p) => p.kind === "hour" && typeof p.rainChance === "number")
    : undefined;
  const effectiveRain =
    typeof upcomingHourPoint?.rainChance === "number"
      ? upcomingHourPoint.rainChance
      : weather.precipitation.chance;
  const wind = weather.wind.speedKph;

  if (explicitWait || effectiveRain >= 70 || wind >= 38) {
    return {
      level: "wait",
      labelEn: "Wait / High risk",
      labelLg: "Linda / Obulabe bwa maanyi",
    };
  }
  if (explicitCaution || effectiveRain >= 35 || wind >= 24) {
    return {
      level: "caution",
      labelEn: "Caution",
      labelLg: "Beera mwegendereza",
    };
  }
  return {
    level: "go",
    labelEn: "Safe to go",
    labelLg: "Obudde bulungi",
  };
}

/**
 * Native Firebase AI Logic JSON Schema (`Schema.object`) for structured
 * weather safety verdicts and follow-up suggestions across both cloud
 * (`responseSchema`) and on-device Gemini Nano (`responseConstraint`).
 */
export const ADVISOR_STRUCTURED_OUTPUT_SCHEMA = Schema.object({
  properties: {
    advisoryText: Schema.string({
      description: "Plain, practical weather guidance grounded in the provided forecast.",
    }),
    verdictLevel: Schema.enumString({
      enum: ["go", "caution", "wait", "none"],
      description: "Overall safety risk level for the user's question.",
    }),
    verdictLabel: Schema.string({
      description: "Short 2 to 4 word verdict heading in the active language.",
    }),
    followUps: Schema.array({
      items: Schema.string({
        description: "Short, contextual next question the user might ask.",
      }),
    }),
  },
  optionalProperties: ["verdictLabel", "followUps"],
});

export interface StructuredAdvisorJsonOutput {
  advisoryText: string;
  verdict?: SafetyVerdict;
  verdictExplicitlyNone: boolean;
  followUps: string[];
}

/**
 * Safely parses a JSON response constrained by `ADVISOR_STRUCTURED_OUTPUT_SCHEMA`
 * and maps it to our typed advisor verdict and follow-up structures.
 */
export function parseStructuredAdvisorJson(
  rawJson: string,
): StructuredAdvisorJsonOutput | null {
  try {
    const parsed = JSON.parse(rawJson.trim()) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.advisoryText !== "string") {
      return null;
    }
    const advisoryText = parsed.advisoryText.trim();
    if (!advisoryText) return null;

    const rawLevel =
      typeof parsed.verdictLevel === "string" ? parsed.verdictLevel.toLowerCase() : "none";
    const rawLabel =
      typeof parsed.verdictLabel === "string" ? parsed.verdictLabel.trim().slice(0, 60) : "";

    let verdict: SafetyVerdict | undefined;
    let verdictExplicitlyNone = false;
    if (rawLevel === "none") {
      verdictExplicitlyNone = true;
    } else if (rawLevel === "go" || rawLevel === "caution" || rawLevel === "wait") {
      const fallbackEn =
        rawLevel === "go" ? "Safe to go" : rawLevel === "caution" ? "Caution" : "Wait / High risk";
      const fallbackLg =
        rawLevel === "go"
          ? "Obudde bulungi"
          : rawLevel === "caution"
            ? "Beera mwegendereza"
            : "Linda / Obulabe bwa maanyi";
      verdict = {
        level: rawLevel,
        labelEn: rawLabel || fallbackEn,
        labelLg: rawLabel || fallbackLg,
      };
    }

    const followUps = Array.isArray(parsed.followUps)
      ? parsed.followUps
          .filter((item): item is string => typeof item === "string" && item.trim().length >= 5)
          .map((item) => item.trim().slice(0, 90))
          .slice(0, 2)
      : [];

    return {
      advisoryText,
      verdict,
      verdictExplicitlyNone,
      followUps,
    };
  } catch {
    return null;
  }
}
