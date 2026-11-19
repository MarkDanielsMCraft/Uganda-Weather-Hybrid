import {
  getGenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  InferenceMode,
  InferenceSource,
  ThinkingLevel,
  type SafetySetting,
} from "firebase/ai";
import {
  checkAndRecordAdvisorRateLimit,
  containsInternalPromptLeakage,
  isPromptInjectionOrAbuse,
  matchInstantSocialReply,
  sanitizeUserMessage,
} from "@/lib/ai/advisor-guard";
import {
  AdvisorRequestInputSchema,
  buildAdvisorSystemInstruction,
  buildWeatherContextPrompt,
  type AdvisorAudience,
  type AdvisorTurn,
} from "@/lib/ai/advisor-prompt";
import {
  getFirebaseAiClient,
  isFirebaseAiConfigured,
} from "@/lib/ai/firebase-client";
import { getAdvisorRemoteConfig } from "@/lib/ai/remote-config";
import type { SupportedLocale } from "@/lib/i18n/types";
import type { WeatherBundle } from "@/types/weather";

let cloudStreamParseFailed = false;

const ADVISOR_SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export type OnDeviceModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export type HybridRuntimeReadiness =
  | "on_device_ready"
  | "cloud_ready"
  | "offline_unavailable"
  | "unconfigured";

export type BriefingInferenceSource = "on_device" | "cloud";

export type BriefingPhase = "thinking" | "writing";

export interface WeatherBriefingResult {
  text: string;
  source: BriefingInferenceSource;
  model: string;
  generatedAt: string;
  usedCachedWeather: boolean;
}

export type WeatherBriefingErrorCode =
  | "invalid_input"
  | "blocked_abuse"
  | "rate_limited"
  | "not_configured"
  | "offline_no_on_device"
  | "aborted"
  | "failed";

export interface WeatherBriefingError {
  code: WeatherBriefingErrorCode;
  message: string;
}

export type WeatherBriefingOutcome =
  | { ok: true; data: WeatherBriefingResult }
  | { ok: false; error: WeatherBriefingError };

interface BrowserLanguageModelApi {
  availability?: (options?: {
    expectedInputs?: Array<{ type: "text"; languages?: string[] }>;
    expectedOutputs?: Array<{ type: "text"; languages?: string[] }>;
  }) => Promise<string>;
}

/** Probes whether the browser exposes an on-device language model (Prompt API).
    Never throws; returns "unavailable" in SSR or unsupported browsers. */
export async function detectOnDeviceAvailability(): Promise<OnDeviceModelAvailability> {
  if (typeof globalThis === "undefined") return "unavailable";

  const scope = globalThis as typeof globalThis & {
    LanguageModel?: BrowserLanguageModelApi;
  };
  const api = scope.LanguageModel;
  if (!api || typeof api.availability !== "function") {
    return "unavailable";
  }

  try {
    const status = await api.availability({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    if (status === "available" || status === "readily") return "available";
    if (status === "downloadable" || status === "after-download") return "downloadable";
    if (status === "downloading") return "downloading";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export function resolveHybridReadiness({
  isOnline,
  onDeviceAvailability,
  cloudConfigured,
}: {
  isOnline: boolean;
  onDeviceAvailability: OnDeviceModelAvailability;
  cloudConfigured: boolean;
}): HybridRuntimeReadiness {
  if (onDeviceAvailability === "available") {
    return "on_device_ready";
  }
  if (!isOnline) {
    return "offline_unavailable";
  }
  if (cloudConfigured) {
    return "cloud_ready";
  }
  return "unconfigured";
}

function nextWithAbort<T>(
  iterator: AsyncIterator<T>,
  signal?: AbortSignal,
): Promise<IteratorResult<T>> {
  if (!signal) return iterator.next();
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<IteratorResult<T>>((resolve, reject) => {
    const onAbort = () => {
      void iterator.return?.().catch(() => {});
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    iterator.next().then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

function sanitizeBriefingText(raw: string): string {
  return raw
    .replace(/[—–]/g, ", ")
    .replace(/[←→⇐⇒⬅➡]/g, " to ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(?<![\w°])(-?\d+(?:\.\d+)?)\s*C\b/g, "$1°C")
    .replace(/(\d+(?:\.\d+)?)\s+kilomet(?:er|re)s?\s+per\s+hour\b/gi, "$1 km/h")
    .replace(/(\d+(?:\.\d+)?)\s+kilomet(?:er|re)s?\b/gi, "$1 km")
    .replace(/(\d+(?:\.\d+)?)\s+millimet(?:er|re)s?\b/gi, "$1 mm")
    .trim();
}

export async function generateHybridWeatherBriefing({
  weather,
  audience,
  language,
  customQuestion,
  history,
  spellingCorrection,
  isOnline = typeof navigator !== "undefined" ? navigator.onLine : true,
  signal,
  onPhaseChange,
  onChunk,
}: {
  weather: WeatherBundle;
  audience: AdvisorAudience;
  language: SupportedLocale;
  customQuestion?: string;
  history?: AdvisorTurn[];
  spellingCorrection?: { typed: string; resolvedName: string };
  isOnline?: boolean;
  signal?: AbortSignal;
  onPhaseChange?: (phase: BriefingPhase) => void;
  onChunk?: (accumulatedText: string) => void;
}): Promise<WeatherBriefingOutcome> {
  const isLg = language === "lg";
  const sanitizedQuestion =
    typeof customQuestion === "string" ? sanitizeUserMessage(customQuestion) : undefined;
  const parsed = AdvisorRequestInputSchema.safeParse({
    audience,
    language,
    customQuestion: sanitizedQuestion,
  });
  if (!parsed.success) {
    console.warn("[ai-advisor] action blocked action=generate code=INVALID_INPUT");
    return {
      ok: false,
      error: {
        code: "invalid_input",
        message: isLg
          ? "Ekibuuzo tekirina kusukka nnukuta 240."
          : "Keep questions under 240 characters.",
      },
    };
  }

  // Handle pure greetings, thanks, farewells, and acknowledgments locally
  // without spending cloud quota or showing a slow "Thinking" wait.
  if (parsed.data.customQuestion) {
    const instant = matchInstantSocialReply(
      parsed.data.customQuestion,
      weather.district.name,
      parsed.data.language,
    );
    if (instant) {
      return {
        ok: true,
        data: {
          text: instant.text,
          source: "on_device",
          model: "local-guard",
          generatedAt: new Date().toISOString(),
          usedCachedWeather: Boolean(weather.stale),
        },
      };
    }

    if (isPromptInjectionOrAbuse(parsed.data.customQuestion)) {
      console.warn("[ai-advisor] action blocked action=generate code=PROMPT_INJECTION_BLOCKED");
      return {
        ok: false,
        error: {
          code: "blocked_abuse",
          message: isLg
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Yuganda kyokka. Buuza ekibuuzo ku nkuba, empewo, oba olugendo."
            : "I can only help with Uganda weather and safety questions. Ask about rain, wind, farming, lakes, or travel.",
        },
      };
    }
  }

  const rateLimit = checkAndRecordAdvisorRateLimit();
  if (!rateLimit.allowed) {
    const waitSeconds = rateLimit.retryAfterSeconds ?? 5;
    console.warn("[ai-advisor] action blocked action=generate code=RATE_LIMITED");
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message: isLg
          ? `Osabye emirundi mingi mu kaseera katono. Linda sikonda ${waitSeconds} oddemu okubuuza.`
          : `Too many requests. Please wait ${waitSeconds} seconds before asking again.`,
      },
    };
  }

  const ai = getFirebaseAiClient();
  if (!ai) {
    console.warn("[ai-advisor] action blocked action=generate code=NOT_CONFIGURED");
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: isLg
          ? "Omuwi w'amagezi tategekeddwa wano."
          : "Advisor is not configured for this environment.",
      },
    };
  }

  const onDeviceStatus = await detectOnDeviceAvailability();
  if (!isOnline && onDeviceStatus !== "available") {
    console.warn("[ai-advisor] action blocked action=generate code=OFFLINE_NO_ON_DEVICE");
    return {
      ok: false,
      error: {
        code: "offline_no_on_device",
        message: isLg
          ? "Okuddamu awatali mutimbagano tekukola wano kati. Dda ku mutimbagano oba kebera obubaka obuterekeddwa."
          : "Offline replies need a browser with built in on device AI. Switch back to Online or check your saved forecast.",
      },
    };
  }

  const remoteConfig = getAdvisorRemoteConfig();
  if (!remoteConfig.enabled) {
    console.warn("[ai-advisor] action blocked action=generate code=DISABLED_BY_REMOTE_CONFIG");
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: isLg
          ? "Omuwi w'amagezi ayimiriziddwa okumala akaseera. Ddamu ogezeeko oluvannyuma."
          : "Advisor is temporarily paused. Try again shortly.",
      },
    };
  }

  const systemInstruction = buildAdvisorSystemInstruction(
    parsed.data.audience,
    parsed.data.language,
  );
  const prompt = buildWeatherContextPrompt(
    weather,
    parsed.data.audience,
    parsed.data.language,
    parsed.data.customQuestion,
    history,
    spellingCorrection,
  );
  const cloudModelName = remoteConfig.cloudModel;
  const mode = !isOnline
    ? InferenceMode.ONLY_ON_DEVICE
    : remoteConfig.preferOnDevice
      ? InferenceMode.PREFER_ON_DEVICE
      : InferenceMode.PREFER_IN_CLOUD;

  try {
    onPhaseChange?.("thinking");

    const inCloudGenerationConfig = cloudModelName.includes("flash-lite")
      ? {
          maxOutputTokens: remoteConfig.maxOutputTokens,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        }
      : {
          maxOutputTokens: Math.max(remoteConfig.maxOutputTokens, 1024),
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        };

    const model = getGenerativeModel(ai, {
      mode,
      inCloudParams: {
        model: cloudModelName,
        systemInstruction,
        generationConfig: inCloudGenerationConfig,
        safetySettings: ADVISOR_SAFETY_SETTINGS,
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: systemInstruction }],
            },
          ],
        },
      },
    });

    const requestOptions = signal ? { signal } : undefined;
    let rawText = "";
    let inferenceSource: InferenceSource | undefined;

    const preferStream =
      typeof model.generateContentStream === "function" &&
      (onDeviceStatus === "available" || !cloudStreamParseFailed);

    if (preferStream) {
      try {
        const streamResult = await model.generateContentStream!(prompt, requestOptions);
        // Prevent unhandled rejection if stream iteration fails or aborts before awaiting response.
        void streamResult.response.catch(() => {});
        let startedWriting = false;
        const iterator = streamResult.stream[Symbol.asyncIterator]();

        while (true) {
          const step = await nextWithAbort(iterator, signal);
          if (step.done) break;
          const chunk = step.value;
          const piece = chunk.text();
          if (piece) {
            if (!startedWriting) {
              startedWriting = true;
              onPhaseChange?.("writing");
            }
            rawText += piece;
            onChunk?.(sanitizeBriefingText(rawText));
          }
          if (chunk.inferenceSource) {
            inferenceSource = chunk.inferenceSource;
          }
        }

        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const finalResponse = await streamResult.response;
        if (!rawText) {
          rawText = finalResponse.text();
        }
        if (finalResponse.inferenceSource) {
          inferenceSource = finalResponse.inferenceSource;
        }
      } catch (streamError) {
        if (
          signal?.aborted ||
          (streamError instanceof DOMException && streamError.name === "AbortError")
        ) {
          throw new DOMException("Aborted", "AbortError");
        }
        // Stream parsing can fail intermittently on SSE chunk boundaries
        // (AI/parse-failed). Fall back cleanly to non-streaming generation
        // and remember for subsequent cloud turns in this session to avoid
        // repeating the slow double-request delay.
        if (onDeviceStatus !== "available") {
          cloudStreamParseFailed = true;
        }
        console.warn("[ai-advisor] stream interrupted, retrying with standard request");
        const result = await model.generateContent(prompt, requestOptions);
        onPhaseChange?.("writing");
        rawText = result.response.text();
        inferenceSource = result.response.inferenceSource;
        onChunk?.(sanitizeBriefingText(rawText));
      }
    } else {
      const result = await model.generateContent(prompt, requestOptions);
      onPhaseChange?.("writing");
      rawText = result.response.text();
      inferenceSource = result.response.inferenceSource;
      onChunk?.(sanitizeBriefingText(rawText));
    }

    const responseText = sanitizeBriefingText(rawText);

    if (!responseText) {
      return {
        ok: false,
        error: {
          code: "failed",
          message: isLg
            ? "Tewali kuddibwamu. Ddamu ogezeeko."
            : "Empty response. Try again.",
        },
      };
    }

    if (containsInternalPromptLeakage(responseText)) {
      console.warn("[ai-advisor] action blocked action=generate code=OUTPUT_LEAK_BLOCKED");
      return {
        ok: false,
        error: {
          code: "blocked_abuse",
          message: isLg
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Yuganda kyokka. Buuza ekibuuzo ku nkuba, empewo, oba olugendo."
            : "I can only help with Uganda weather and safety questions. Ask about rain, wind, farming, lakes, or travel.",
        },
      };
    }

    const source: BriefingInferenceSource =
      inferenceSource === InferenceSource.ON_DEVICE || mode === InferenceMode.ONLY_ON_DEVICE
        ? "on_device"
        : "cloud";

    return {
      ok: true,
      data: {
        text: responseText,
        source,
        model: source === "on_device" ? "on-device" : cloudModelName,
        generatedAt: new Date().toISOString(),
        usedCachedWeather: Boolean(weather.stale),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "aborted",
          message: "Request cancelled.",
        },
      };
    }

    const safeDistrictSlug = weather.district.slug.replace(/[^\w:.-]/g, "");

    if (!isOnline) {
      console.warn(
        `[ai-advisor] action blocked action=generate code=OFFLINE_EXECUTION_FAILED district=${safeDistrictSlug}`,
      );
      return {
        ok: false,
        error: {
          code: "offline_no_on_device",
          message: isLg
            ? "Enkola ey'awatali mutimbagano teyinza kukola kati. Dda ku mutimbagano."
            : "Local model unavailable offline. Reconnect for cloud fallback.",
        },
      };
    }

    const errMsg = error instanceof Error ? error.message : "";
    if (/safety|blocked/i.test(errMsg)) {
      console.warn(
        `[ai-advisor] action blocked action=generate code=SAFETY_FILTER_BLOCKED district=${safeDistrictSlug}`,
      );
      return {
        ok: false,
        error: {
          code: "blocked_abuse",
          message: isLg
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Yuganda kyokka. Buuza ekibuuzo ku nkuba, empewo, oba olugendo."
            : "I can only help with Uganda weather and safety questions. Ask about rain, wind, farming, lakes, or travel.",
        },
      };
    }

    console.error(
      `[ai-advisor] action failed action=generate district=${safeDistrictSlug} configured=${String(isFirebaseAiConfigured())}:`,
      error,
    );
    return {
      ok: false,
      error: {
        code: "failed",
        message: isLg
          ? "Tetuyinza kuddamu kati. Ddamu ogezeeko."
          : "Could not reply right now. Try again.",
      },
    };
  }
}
