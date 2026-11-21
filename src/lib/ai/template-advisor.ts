import { getTemplateGenerativeModel, type AI } from "firebase/ai";
import type { AdvisorAudience, AdvisorTurn } from "@/lib/ai/advisor-prompt";
import type { SupportedLocale } from "@/lib/i18n/types";
import type { WeatherBundle } from "@/types/weather";

export interface ServerTemplateVariables {
  district: string;
  region: string;
  currentTempC: number;
  condition: string;
  rainChancePct: number;
  windKph: number;
  humidityPct: number;
  highTempC: number;
  lowTempC: number;
  isDay: boolean;
  language: SupportedLocale;
  audience: AdvisorAudience;
  question: string;
  historySummary: string;
}

/**
 * Builds minimal, non-PII weather and query variables for Firebase AI Logic
 * Server Prompt Templates so system instructions remain server-side in
 * Firebase Console rather than hardcoded in the browser bundle.
 */
export function buildServerTemplateVariables({
  weather,
  audience,
  language,
  question,
  history,
}: {
  weather: WeatherBundle;
  audience: AdvisorAudience;
  language: SupportedLocale;
  question: string;
  history?: readonly AdvisorTurn[];
}): ServerTemplateVariables {
  const nextRain = Math.round(weather.hourly?.[0]?.rainChance ?? 0);
  const recentHistory = (history ?? [])
    .slice(-4)
    .map((t) => `${t.role === "user" ? "User" : "Advisor"}: ${t.text.slice(0, 180)}`)
    .join(" | ");

  return {
    district: weather.district.name,
    region: weather.district.region,
    currentTempC: Math.round(weather.temperature.celsius),
    condition: weather.condition.text,
    rainChancePct: nextRain,
    windKph: Math.round(weather.wind.speedKph),
    humidityPct: Math.round(weather.humidity),
    highTempC: Math.round(weather.daily.high),
    lowTempC: Math.round(weather.daily.low),
    isDay: weather.isDay,
    language,
    audience,
    question: question.trim().slice(0, 240),
    historySummary: recentHistory,
  };
}

/**
 * Executes a cloud weather briefing via Firebase AI Logic Server Prompt
 * Templates (`getTemplateGenerativeModel`). Returns null if the template is
 * unavailable so the caller can seamlessly fall back to standard inference.
 */
export async function generateWithServerPromptTemplate({
  ai,
  templateId,
  variables,
  signal,
  onPhaseChange,
  onRawChunk,
}: {
  ai: AI;
  templateId: string;
  variables: ServerTemplateVariables;
  signal?: AbortSignal;
  onPhaseChange?: (phase: "thinking" | "writing") => void;
  onRawChunk?: (accumulated: string) => void;
}): Promise<string | null> {
  if (!templateId.trim() || signal?.aborted) return null;

  try {
    const templateModel = getTemplateGenerativeModel(ai);
    const requestOptions = signal ? { signal } : undefined;
    const templateVariables: Record<string, unknown> = { ...variables };

    if (typeof templateModel.generateContentStream === "function") {
      try {
        const streamResult = await templateModel.generateContentStream(
          { templateId, templateVariables },
          requestOptions,
        );
        void streamResult.response.catch(() => {});
        let rawText = "";
        let started = false;
        for await (const chunk of streamResult.stream) {
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const piece = chunk.text();
          if (piece) {
            if (!started) {
              started = true;
              onPhaseChange?.("writing");
            }
            rawText += piece;
            onRawChunk?.(rawText);
          }
        }
        const finalResp = await streamResult.response;
        const text = (rawText || finalResp.text()).trim();
        return text || null;
      } catch (streamError) {
        if (
          signal?.aborted ||
          (streamError instanceof DOMException && streamError.name === "AbortError")
        ) {
          throw streamError;
        }
        // Retry once with unary template generateContent
      }
    }

    const unary = await templateModel.generateContent(
      { templateId, templateVariables },
      requestOptions,
    );
    const text = unary.response.text().trim();
    if (text) {
      onPhaseChange?.("writing");
      onRawChunk?.(text);
      return text;
    }
    return null;
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw error;
    }
    console.warn("[ai-advisor] server prompt template unavailable, falling back to standard model");
    return null;
  }
}
