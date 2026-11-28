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
  redactPiiForCloud,
  sanitizeUserMessage,
  withPromptSafePlaceText,
} from "@/lib/ai/advisor-guard";
import {
  AdvisorRequestInputSchema,
  buildAdvisorSystemInstruction,
  buildWeatherContextPrompt,
  type AdvisorAudience,
  type AdvisorTurn,
} from "@/lib/ai/advisor-prompt";
import {
  getConfiguredCloudModel,
  getFirebaseAiClient,
  isAppCheckActive,
  isFirebaseAiConfigured,
} from "@/lib/ai/firebase-client";
import type { AdvisorImageMetadata } from "@/lib/ai/advisor-image";
import {
  deriveSafetyVerdict,
  executeAdvisorToolCall,
  isMultiLocationQuery,
  parseAgentStructuredDirectives,
  UGANDA_WEATHER_TOOL,
  type SafetyVerdict,
} from "@/lib/ai/advisor-tools";
import { buildSavedForecastBriefing, type SavedForecastNotice } from "@/lib/ai/offline-briefing";
import { getAdvisorRemoteConfig } from "@/lib/ai/remote-config";
import {
  buildServerTemplateVariables,
  generateWithServerPromptTemplate,
} from "@/lib/ai/template-advisor";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatClockLabelForLanguage } from "@/lib/time/uganda";
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

export type BriefingInferenceSource = "on_device" | "cloud" | "saved_forecast";

export type BriefingPhase = "thinking" | "writing";

export interface WeatherBriefingResult {
  text: string;
  source: BriefingInferenceSource;
  model: string;
  generatedAt: string;
  usedCachedWeather: boolean;
  verdict?: SafetyVerdict;
  followUps?: string[];
  toolsUsed?: string[];
}

export type WeatherBriefingErrorCode =
  | "invalid_input"
  | "blocked_abuse"
  | "rate_limited"
  | "not_configured"
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

function hasUserGreeting(question?: string): boolean {
  if (!question) return false;
  return /\b(gyebaleko|gyebale|wasuze|osiibye|agafa|oli\s+otya|koddi|hi|hello|hey|good\s+(?:morning|afternoon|evening))\b/i.test(
    question,
  );
}

function sanitizeBriefingText(
  raw: string,
  language: SupportedLocale = "en",
  userGreeted = false,
): string {
  let cleaned = raw
    .replace(/[—–]/g, ", ")
    .replace(/[←→⇐⇒⬅➡]/g, " to ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|[^\w°])(-?\d+(?:\.\d+)?)\s*C\b/g, "$1$2°C")
    .replace(/(\d+(?:\.\d+)?)\s+kilomet(?:er|re)s?\s+per\s+hour\b/gi, "$1 km/h")
    .replace(/(\d+(?:\.\d+)?)\s+kilomet(?:er|re)s?\b/gi, "$1 km")
    .replace(/(\d+(?:\.\d+)?)\s+millimet(?:er|re)s?\b/gi, "$1 mm")
    .trim();

  if (language === "lg") {
    if (!userGreeted) {
      cleaned = cleaned.replace(
        /^(?:Kale,\s*)?we+bale(?:\s+(?:nnyo|kubuuza))?[.!]\s*/i,
        "",
      );
    }
    cleaned = cleaned
      // Convert any stray English "mu <Name> District" or "<Name> District" into authentic Luganda
      .replace(/\bmu\s+([A-Z][A-Za-z'-]+)\s+District\b/g, "mu Disitulikiti y'e $1")
      .replace(/\be\s+([A-Z][A-Za-z'-]+)\s+District\b/g, "mu Disitulikiti y'e $1")
      .replace(/\b([A-Z][A-Za-z'-]+)\s+District\b/g, "Disitulikiti y'e $1")
      .replace(/\bmu\s+([A-Z][A-Za-z'-]+)\s+City\b/g, "mu Kibuga $1")
      .replace(/\b([A-Z][A-Za-z'-]+)\s+City\b/g, "Ekibuga $1")
      // Convert any stray English 12-hour AM/PM clock time in Luganda prose into 6-hour-shifted Luganda equatorial time
      .replace(
        /\b(?:ssaawa\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi,
        (full, clock: string) => {
          const formatted = formatClockLabelForLanguage(clock.trim(), "lg", "medium");
          return formatted !== clock.trim() ? `ssaawa ${formatted}` : full;
        },
      )
      // Fix common NMT/LLM lexical and orthography slips in Luganda weather prose
      .replace(/\bmu\s+ssaawa\s+ezikaddewo\b/gi, "mu ssaawa eziddako")
      .replace(/\bomusana\s+(?:ogw'amaanyi\s+)?ogw'ekiro\b/gi, "omusulo gw'ekiro")
      .replace(/\bomume\b/gi, "omusulo")
      .replace(/\b([Ww])ebale\b/g, "$1eebale")
      .replace(/\bgukyakyali\b/gi, "gukyali")
      .replace(/\bobudde\s+bw'enkya\s+enkya\b/gi, "obudde bw'enkya")
      .replace(/\b([Nn]g')omunsana\b/g, "$1omusana")
      .replace(/\bomunsana\b/gi, "omusana")
      .replace(/\b([Nn]g)a\s+([aeiou][a-z'])/g, "$1'$2")
      .replace(/\b(ez|ey|ogw|olw|ak|obw)'okumakya\b/gi, "$1'oku makya");
  }

  return cleaned;
}

function ensureSpellingCorrectionPrefix(
  text: string,
  language: SupportedLocale,
  spellingCorrection?: { typed: string; resolvedName: string },
): string {
  if (!spellingCorrection || !text.trim()) return text;
  if (/did\s+you\s+mean|obadde\s+otegeeza/i.test(text)) {
    return text;
  }
  const prefix =
    language === "lg"
      ? `Obadde otegeeza ${spellingCorrection.resolvedName}? `
      : `Did you mean ${spellingCorrection.resolvedName}? `;
  return `${prefix}${text}`;
}

/** Answer built only from the forecast numbers. Used when no model can
    answer (offline with no on-device model, or the cloud model failing), so
    the advisor still helps instead of showing an error. */
function savedForecastOutcome(
  weather: WeatherBundle,
  audience: AdvisorAudience,
  language: SupportedLocale,
  notice: SavedForecastNotice,
  spellingCorrection?: { typed: string; resolvedName: string },
): WeatherBriefingOutcome {
  const briefing = buildSavedForecastBriefing({
    weather,
    audience,
    language,
    notice,
    spellingCorrection,
  });
  return {
    ok: true,
    data: {
      text: briefing.text,
      source: "saved_forecast",
      model: "saved-forecast",
      generatedAt: new Date().toISOString(),
      usedCachedWeather: Boolean(weather.stale),
      verdict: briefing.verdict,
    },
  };
}

export async function generateHybridWeatherBriefing({
  weather: rawWeather,
  audience,
  language,
  customQuestion,
  history,
  spellingCorrection,
  image,
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
  image?: {
    base64: string;
    mimeType: string;
    metadata?: AdvisorImageMetadata;
  };
  isOnline?: boolean;
  signal?: AbortSignal;
  onPhaseChange?: (phase: BriefingPhase) => void;
  onChunk?: (accumulatedText: string) => void;
}): Promise<WeatherBriefingOutcome> {
  const weather = withPromptSafePlaceText(rawWeather);
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
          : "Please keep your question short, under 240 letters.",
      },
    };
  }

  if (parsed.data.customQuestion) {
    if (isPromptInjectionOrAbuse(parsed.data.customQuestion)) {
      console.warn("[ai-advisor] action blocked action=generate code=PROMPT_INJECTION_BLOCKED");
      return {
        ok: false,
        error: {
          code: "blocked_abuse",
          message: isLg
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Uganda wokka. Buuza ekibuuzo ku nkuba, empewo, ebyobulimi, ennyanja, oba olugendo."
            : "I can only help with Uganda weather and safety questions. Ask about rain, wind, farming, lakes, or travel.",
        },
      };
    }
  }

  const ai = getFirebaseAiClient();
  if (!ai && !isOnline) {
    // The offline summary needs no Firebase client, so a missing or broken
    // client configuration must not take offline answers away.
    return savedForecastOutcome(
      weather,
      parsed.data.audience,
      parsed.data.language,
      parsed.data.customQuestion ? "offline" : "none",
      spellingCorrection,
    );
  }
  if (!ai) {
    console.warn("[ai-advisor] action blocked action=generate code=NOT_CONFIGURED");
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: isLg
          ? "Omuwi w'amagezi tali mwetegefu kati. Ddamu ogezeeko oluvannyuma."
          : "Weather advisor is not ready right now. Please try again later.",
      },
    };
  }

  const onDeviceStatus = await detectOnDeviceAvailability();
  // On-device Gemini Nano writes English only, so offline Luganda also uses
  // the saved forecast summary instead of a reply in the wrong language.
  const onDeviceCanAnswer = onDeviceStatus === "available" && parsed.data.language !== "lg";
  if (!isOnline && !onDeviceCanAnswer) {
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
            model: "on-device",
            generatedAt: new Date().toISOString(),
            usedCachedWeather: Boolean(weather.stale),
          },
        };
      }
    }
    return savedForecastOutcome(
      weather,
      parsed.data.audience,
      parsed.data.language,
      parsed.data.customQuestion ? "offline" : "none",
      spellingCorrection,
    );
  }

  const remoteConfig = getAdvisorRemoteConfig();
  if (!remoteConfig.enabled) {
    console.warn("[ai-advisor] action blocked action=generate code=DISABLED_BY_REMOTE_CONFIG");
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: isLg
          ? "Omuwi w'amagezi awummuddeko akaseera. Ddamu ogezeeko mangu."
          : "Weather advisor is taking a short break. Please try again soon.",
      },
    };
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
          : `Please wait ${waitSeconds} seconds before asking again.`,
      },
    };
  }

  const generationLanguage = parsed.data.language;
  const rawQuestion = parsed.data.customQuestion;
  const userGreeted = hasUserGreeting(rawQuestion);
  const hasImage = Boolean(image?.base64);
  const wantsMultiDistrictTool = Boolean(rawQuestion && isMultiLocationQuery(rawQuestion));
  const shouldEnableTools = isOnline && !hasImage && wantsMultiDistrictTool;
  // On-device Gemini Nano currently supports English output only, so Luganda
  // queries escalate to Cloud Gemini while online (and use deterministic
  // Luganda offline fallback when offline).
  const needsCloudForLanguage = generationLanguage === "lg";
  const mode = !isOnline
    ? InferenceMode.ONLY_ON_DEVICE
    : hasImage || shouldEnableTools || needsCloudForLanguage
      ? InferenceMode.ONLY_IN_CLOUD
      : remoteConfig.preferOnDevice
        ? InferenceMode.PREFER_ON_DEVICE
        : InferenceMode.PREFER_IN_CLOUD;

  // Privacy Shield: redact accidental phone numbers, emails, or NINs before any
  // prompt or history turn can leave the device for cloud inference.
  const willPotentiallyUseCloud = mode !== InferenceMode.ONLY_ON_DEVICE;
  const promptQuestion =
    rawQuestion && willPotentiallyUseCloud
      ? redactPiiForCloud(rawQuestion).sanitized
      : rawQuestion;
  const safeHistory =
    willPotentiallyUseCloud && history && history.length > 0
      ? history.map((turn) =>
          turn.role === "user"
            ? { ...turn, text: redactPiiForCloud(turn.text).sanitized }
            : turn,
        )
      : history;

  const systemInstruction = buildAdvisorSystemInstruction(
    parsed.data.audience,
    generationLanguage,
  );
  const prompt = buildWeatherContextPrompt(
    weather,
    parsed.data.audience,
    generationLanguage,
    promptQuestion,
    safeHistory,
    spellingCorrection,
  );
  const cloudModelName = remoteConfig.cloudModel;

  try {
    onPhaseChange?.("thinking");

    const minTokenBudget =
      generationLanguage === "lg"
        ? Math.max(remoteConfig.maxOutputTokens, 1024)
        : remoteConfig.maxOutputTokens;
    const inCloudGenerationConfig = cloudModelName.includes("flash-lite")
      ? {
          maxOutputTokens: minTokenBudget,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        }
      : {
          maxOutputTokens: Math.max(minTokenBudget, 1024),
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
        ...(shouldEnableTools ? { tools: [UGANDA_WEATHER_TOOL] } : {}),
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
    const toolsUsed: string[] = [];

    // Phase 3: When a Server Prompt Template ID is published in Firebase Remote
    // Config and we are executing a cloud text briefing (no local Gemini Nano,
    // no image, no multi-district tool call), run via Firebase Server Prompt
    // Templates so prompt instructions stay completely server-side.
    const canUseServerTemplate =
      Boolean(remoteConfig.promptTemplateId) &&
      isOnline &&
      !hasImage &&
      !shouldEnableTools &&
      onDeviceStatus !== "available";

    if (canUseServerTemplate) {
      const templateVars = buildServerTemplateVariables({
        weather,
        audience: parsed.data.audience,
        language: generationLanguage,
        question: promptQuestion || "Give today's weather safety summary.",
        history: safeHistory,
      });
      const templateText = await generateWithServerPromptTemplate({
        ai,
        templateId: remoteConfig.promptTemplateId,
        variables: templateVars,
        signal,
        onPhaseChange,
        onRawChunk: (accumulated) => {
          const visibleStream = parseAgentStructuredDirectives(
            sanitizeBriefingText(accumulated, generationLanguage, userGreeted),
          ).cleanText;
          if (visibleStream) {
            onChunk?.(visibleStream);
          }
        },
      });
      if (templateText) {
        rawText = templateText;
        inferenceSource = InferenceSource.IN_CLOUD;
      }
    }

    const buildPhotoVerificationBlock = (): string => {
      const meta = image?.metadata;
      const notes: string[] = [
        "The user attached a photo or screenshot.",
      ];
      if (meta?.capturedAtIso) {
        const ageDesc =
          meta.ageMinutes !== null && meta.ageMinutes >= 60
            ? `${Math.round(meta.ageMinutes / 60)} hour(s) ago`
            : meta.ageMinutes !== null
              ? `${meta.ageMinutes} minute(s) ago`
              : "unknown age";
        notes.push(
          `Photo capture timestamp (${meta.timestampSource}): ${meta.capturedAtIso} (${ageDesc}). ${
            meta.isStale
              ? "WARNING: This photo is OUTDATED (older than 3 hours). Do NOT treat it as current weather. Clearly tell the user when it was taken and remind them to share a fresh photo for current conditions, then give today's live forecast separately."
              : "Photo appears recent."
          }`,
        );
      } else {
        notes.push(
          "Photo capture timestamp: Not present in file metadata. Check if any clock, date, or timestamp is visible inside the image or screenshot. If it looks old or you cannot confirm when it was taken, say so honestly instead of treating it as live.",
        );
      }

      if (meta?.location) {
        if (!meta.location.withinUganda) {
          notes.push(
            "WARNING: Photo GPS coordinates are OUTSIDE Uganda. Clearly inform the user that this photo was taken outside Uganda and cannot be matched to this Uganda district forecast.",
          );
        } else if (!meta.location.matchesActiveDistrict && meta.location.nearestDistrictName) {
          notes.push(
            `WARNING: Photo GPS coordinates are near ${meta.location.nearestDistrictName} (${meta.location.distanceToActiveKm ?? "far"} km away from ${weather.district.name}). Clearly tell the user this photo appears to be from ${meta.location.nearestDistrictName}, not ${weather.district.name}, and advise them to switch district if they want the forecast for ${meta.location.nearestDistrictName}.`,
          );
        } else {
          notes.push(
            `Photo GPS matches the active area (${weather.district.name}).`,
          );
        }
      } else {
        notes.push(
          `Photo GPS location metadata: Not included (common for screenshots or gallery photos). Inspect any visible place names, landmarks, signs, or weather-app headers in the photo. If the image shows a different district or country than ${weather.district.name}, point that out clearly instead of pretending it matches ${weather.district.name}.`,
        );
      }

      notes.push(
        generationLanguage === "lg"
          ? "Combine what you actually see in the photo with the live forecast only when time and location match. Write your reply in natural, standard Luganda (Empandiika y'Oluganda Entongole)."
          : "Combine what you actually see in the photo with the live forecast only when time and location match. Use plain, simple everyday English.",
      );
      return notes.join(" ");
    };

    const promptInput = hasImage
      ? [
          {
            type: "inlineData" as const,
            inlineData: {
              mimeType: image!.mimeType,
              data: image!.base64,
            },
          },
          {
            type: "text" as const,
            text: `${prompt}\n\n${buildPhotoVerificationBlock()}`,
          },
        ]
      : prompt;

    const preferStream =
      !rawText &&
      !hasImage &&
      !shouldEnableTools &&
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
            const visibleStream = parseAgentStructuredDirectives(
              sanitizeBriefingText(rawText, generationLanguage, userGreeted),
            ).cleanText;
            if (visibleStream) {
              onChunk?.(visibleStream);
            }
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
        onChunk?.(
          parseAgentStructuredDirectives(
            sanitizeBriefingText(rawText, generationLanguage, userGreeted),
          ).cleanText,
        );
      }
    } else if (!rawText) {
      if (shouldEnableTools && typeof model.startChat === "function") {
        const chat = model.startChat();
        let turnResult = await chat.sendMessage(promptInput, requestOptions);
        let rounds = 0;
        while (rounds < 2) {
          const calls =
            typeof turnResult.response.functionCalls === "function"
              ? turnResult.response.functionCalls()
              : undefined;
          if (!calls || calls.length === 0) break;
          rounds += 1;
          const toolResponses = await Promise.all(
            calls.map(async (call) => {
              toolsUsed.push(call.name);
              const payload = await executeAdvisorToolCall(call, isOnline, signal);
              return {
                type: "functionResponse" as const,
                functionResponse: {
                  name: call.name,
                  response: payload,
                },
              };
            }),
          );
          turnResult = await chat.sendMessage(toolResponses, requestOptions);
        }
        rawText = turnResult.response.text();
        inferenceSource = turnResult.response.inferenceSource;
      } else {
        const result = await model.generateContent(promptInput, requestOptions);
        rawText = result.response.text();
        inferenceSource = result.response.inferenceSource;
      }
      onPhaseChange?.("writing");
      onChunk?.(
        parseAgentStructuredDirectives(
          sanitizeBriefingText(rawText, generationLanguage, userGreeted),
        ).cleanText,
      );
    }

    const sanitizedRaw = sanitizeBriefingText(rawText, generationLanguage, userGreeted);
    const parsedDirectives = parseAgentStructuredDirectives(sanitizedRaw);
    const responseText = ensureSpellingCorrectionPrefix(
      parsedDirectives.cleanText,
      generationLanguage,
      spellingCorrection,
    );
    const resolvedVerdict = parsedDirectives.verdictExplicitlyNone
      ? undefined
      : (parsedDirectives.verdict ?? deriveSafetyVerdict(weather, sanitizedRaw));
    const resolvedFollowUps = parsedDirectives.followUps;

    if (!responseText) {
      console.warn("[ai-advisor] action blocked action=generate code=EMPTY_REPLY_FALLBACK");
      return savedForecastOutcome(
        weather,
        parsed.data.audience,
        generationLanguage,
        "ai_unavailable",
        spellingCorrection,
      );
    }

    if (containsInternalPromptLeakage(responseText)) {
      console.warn("[ai-advisor] action blocked action=generate code=OUTPUT_LEAK_BLOCKED");
      return {
        ok: false,
        error: {
          code: "blocked_abuse",
          message: isLg
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Uganda wokka. Buuza ekibuuzo ku nkuba, empewo, ebyobulimi, ennyanja, oba olugendo."
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
        verdict: resolvedVerdict,
        ...(resolvedFollowUps.length > 0 ? { followUps: resolvedFollowUps } : {}),
        ...(toolsUsed.length > 0 ? { toolsUsed } : {}),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "aborted",
          message: "Stopped.",
        },
      };
    }

    const safeDistrictSlug = weather.district.slug.replace(/[^\w:.-]/g, "");

    if (!isOnline) {
      console.warn(
        `[ai-advisor] action blocked action=generate code=OFFLINE_EXECUTION_FAILED district=${safeDistrictSlug}`,
      );
      return savedForecastOutcome(
        weather,
        parsed.data.audience,
        parsed.data.language,
        parsed.data.customQuestion ? "offline" : "none",
        spellingCorrection,
      );
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
            ? "Nsonyiwa, nze nkola ku mbeera y'obudde n'obukuumi mu Uganda wokka. Buuza ekibuuzo ku nkuba, empewo, ebyobulimi, ennyanja, oba olugendo."
            : "I can only help with Uganda weather and safety questions. Ask about rain, wind, farming, lakes, or travel.",
        },
      };
    }

    const rawCode =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : error instanceof Error && error.name
          ? error.name
          : "unknown";
    const safeErrorCode = rawCode.replace(/[^\w/:.-]/g, "").slice(0, 64) || "unknown";
    const safeModel = getConfiguredCloudModel().replace(/[^\w/:.-]/g, "").slice(0, 64) || "unknown";

    console.error(
      `[ai-advisor] action failed action=generate code=${safeErrorCode} district=${safeDistrictSlug} configured=${String(isFirebaseAiConfigured())} appCheck=${String(isAppCheckActive())}:`,
      error,
    );

    if (typeof window !== "undefined") {
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        void import("@sentry/nextjs")
          .then((Sentry) => {
            Sentry.captureException(error, {
              tags: {
                component: "ai-advisor",
                action: "generate",
                district: safeDistrictSlug,
                errorCode: safeErrorCode,
              },
            });
          })
          .catch(() => {});
      }

      if (typeof fetch === "function") {
        void fetch("/api/v1/observability/advisor-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            code: safeErrorCode,
            district: safeDistrictSlug || "unknown",
            online: isOnline,
            appCheckActive: isAppCheckActive(),
            model: safeModel,
          }),
        }).catch(() => {});
      }
    }

    // The failure is logged and reported above. The person still gets a
    // summary of the real forecast instead of a dead end.
    return savedForecastOutcome(
      weather,
      parsed.data.audience,
      parsed.data.language,
      "ai_unavailable",
      spellingCorrection,
    );
  }
}
