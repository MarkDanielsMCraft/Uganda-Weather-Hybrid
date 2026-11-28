import { reserveVoiceCall } from "@/lib/voice/voice-budget";
import { createHash } from "node:crypto";
import { z } from "zod";
import { errorResponse } from "@/lib/cache";
import { mergeRateLimitHeaders, rejectCrossSiteRequest } from "@/lib/api/route-utils";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import {
  downsamplePcm16Mono,
  isGeminiTtsConfigured,
  pcm16ToWav,
  streamGeminiNeuralSpeech,
  synthesizeEnglishNeuralSpeech,
  synthesizeLugandaNeuralSpeech,
} from "@/lib/voice/gemini-tts";
import {
  isSunbirdConfigured,
  synthesizeSunbirdSpeech,
  type SynthesizedAudio,
} from "@/lib/voice/sunbird";
import { getCachedVoiceClip, setCachedVoiceClip } from "@/lib/voice/voice-cache";

export const maxDuration = 60;

const SAFE_AUDIO_CONTENT_TYPE =
  /^audio\/[a-z0-9.+-]+(?:;[ \t]*[a-z0-9.+-]+=[a-z0-9.+-]+)*$/i;

function safeAudioHeaderType(raw: string): string {
  const cleaned = raw.trim();
  return cleaned.length <= 128 && SAFE_AUDIO_CONTENT_TYPE.test(cleaned) ? cleaned : "audio/wav";
}

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

function getSpeakRouteConfig() {
  return {
    rateLimit: readPositiveInt(process.env.VOICE_SPEAK_RATE_LIMIT, 45, 200),
    windowMs: readPositiveInt(process.env.VOICE_RATE_WINDOW_MS, 60_000, 3_600_000),
    maxTextChars: readPositiveInt(process.env.VOICE_MAX_TEXT_CHARS, 1_600, 3_000),
    maxInflight: readPositiveInt(process.env.VOICE_MAX_INFLIGHT_SYNTHESIS, 64, 512),
    timeoutMs: readPositiveInt(process.env.VOICE_TIMEOUT_MS, 45_000, 58_000),
    cacheTtlMs: readPositiveInt(process.env.VOICE_CACHE_TTL_MS, 1_800_000, 3_600_000),
    fallbackCacheTtlMs: readPositiveInt(
      process.env.VOICE_FALLBACK_CACHE_TTL_MS,
      300_000,
      3_600_000,
    ),
    sunbirdOpeningTimeoutMs: readPositiveInt(
      process.env.VOICE_SUNBIRD_FALLBACK_TIMEOUT_MS,
      7_500,
      30_000,
    ),
    sunbirdMaxFallbackTimeoutMs: readPositiveInt(
      process.env.VOICE_SUNBIRD_MAX_FALLBACK_TIMEOUT_MS,
      20_000,
      45_000,
    ),
    sunbirdMsPerChar: readPositiveInt(process.env.VOICE_SUNBIRD_MS_PER_CHAR, 110, 500),
    lugandaPrimary:
      process.env.VOICE_LUGANDA_PRIMARY?.trim().toLowerCase() === "sunbird"
        ? ("sunbird" as const)
        : ("gemini" as const),
  };
}

type VoiceProviderTag = "sunbird" | "gemini";

type InflightSpeakOutcome =
  | { kind: "ok"; data: SynthesizedAudio; provider?: VoiceProviderTag; cached: boolean }
  | { kind: "blocked"; response: Response };

const inflightSynthesis = new Map<string, Promise<InflightSpeakOutcome>>();
let activeStreamSynthesisCount = 0;

type LugandaFallbackOutcome =
  | { kind: "ok"; data: SynthesizedAudio; provider: VoiceProviderTag; ttlMs: number }
  | { kind: "blocked"; response: Response };

function concatPcmChunks(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function synthesizeSunbirdWithCap(
  text: string,
  parentSignal: AbortSignal,
  sourceLanguage: "en" | "lg" | undefined,
  cfg: ReturnType<typeof getSpeakRouteConfig>,
): Promise<SynthesizedAudio> {
  const sunbirdTimeoutMs = Math.min(
    cfg.sunbirdMaxFallbackTimeoutMs,
    Math.max(cfg.sunbirdOpeningTimeoutMs, text.length * cfg.sunbirdMsPerChar),
  );
  const sunbirdController = new AbortController();
  const onParentAbort = () => sunbirdController.abort();
  if (parentSignal.aborted) {
    sunbirdController.abort();
  } else {
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }
  const sunbirdTimer = setTimeout(() => sunbirdController.abort(), sunbirdTimeoutMs);
  try {
    return await synthesizeSunbirdSpeech(
      text,
      "lg",
      sunbirdController.signal,
      sourceLanguage,
    );
  } finally {
    clearTimeout(sunbirdTimer);
    parentSignal.removeEventListener("abort", onParentAbort);
  }
}

async function synthesizeLugandaWithFallback(
  text: string,
  parentSignal: AbortSignal,
  sourceLanguage: "en" | "lg" | undefined,
  canSunbird: boolean,
  canGeminiLg: boolean,
  cfg: ReturnType<typeof getSpeakRouteConfig>,
): Promise<LugandaFallbackOutcome> {
  // Gemini 3.8 Flash TTS starts in ~1.4s on Luganda vs 17s+ on a cold Sunbird
  // GPU, so Gemini is primary when configured, with Sunbird strictly preserved
  // in Luganda as automatic fallback (or primary if VOICE_LUGANDA_PRIMARY=sunbird
  // or when translating English source text into Luganda speech).
  const preferGeminiFirst = canGeminiLg && (cfg.lugandaPrimary === "gemini" || !canSunbird);

  if (preferGeminiFirst) {
    if (!canSunbird) {
      const data = await synthesizeLugandaNeuralSpeech(text, parentSignal);
      return { kind: "ok", data, provider: "gemini", ttlMs: cfg.cacheTtlMs };
    }
    let geminiError: unknown;
    try {
      const data = await synthesizeLugandaNeuralSpeech(text, parentSignal);
      return { kind: "ok", data, provider: "gemini", ttlMs: cfg.cacheTtlMs };
    } catch (err) {
      geminiError = err;
    }
    if (parentSignal.aborted) {
      throw geminiError;
    }
    const fallbackBudget = await reserveVoiceCall("speak");
    if (fallbackBudget) {
      return { kind: "blocked", response: fallbackBudget };
    }
    const data = await synthesizeSunbirdSpeech(text, "lg", parentSignal, sourceLanguage);
    return { kind: "ok", data, provider: "sunbird", ttlMs: cfg.fallbackCacheTtlMs };
  }

  if (canSunbird) {
    if (!canGeminiLg) {
      const data = await synthesizeSunbirdSpeech(text, "lg", parentSignal, sourceLanguage);
      return { kind: "ok", data, provider: "sunbird", ttlMs: cfg.cacheTtlMs };
    }
    let sunbirdError: unknown;
    try {
      const data = await synthesizeSunbirdWithCap(text, parentSignal, sourceLanguage, cfg);
      return { kind: "ok", data, provider: "sunbird", ttlMs: cfg.cacheTtlMs };
    } catch (err) {
      sunbirdError = err;
    }
    if (parentSignal.aborted) {
      throw sunbirdError;
    }
    const fallbackBudget = await reserveVoiceCall("speak");
    if (fallbackBudget) {
      return { kind: "blocked", response: fallbackBudget };
    }
    const data = await synthesizeLugandaNeuralSpeech(text, parentSignal);
    return { kind: "ok", data, provider: "gemini", ttlMs: cfg.fallbackCacheTtlMs };
  }

  const data = await synthesizeLugandaNeuralSpeech(text, parentSignal);
  return { kind: "ok", data, provider: "gemini", ttlMs: cfg.cacheTtlMs };
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSiteRequest(request, "voice");
  if (crossSite) return crossSite;

  const cfg = getSpeakRouteConfig();
  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(`voice:speak:${ip}`, cfg.rateLimit, cfg.windowMs);
  if (!limitResult.allowed) {
    console.warn("[voice] action blocked action=speak code=RATE_LIMITED");
    return errorResponse("RATE_LIMITED", "Too many speech requests", 429, {
      resetAt: limitResult.resetAt,
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    console.warn("[voice] action blocked action=speak code=INVALID_JSON");
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const speakRequestSchema = z.object({
    text: z.string().trim().min(1).max(cfg.maxTextChars),
    language: z.enum(["en", "lg"]),
    sourceLanguage: z.enum(["en", "lg"]).optional(),
    stream: z.boolean().optional(),
  });

  const parsed = speakRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.warn("[voice] action blocked action=speak code=VALIDATION_FAILED");
    return errorResponse("BAD_REQUEST", "Invalid speech request payload", 400);
  }

  const { text, language, sourceLanguage } = parsed.data;
  let queryStream = false;
  try {
    queryStream = new URL(request.url).searchParams.get("stream") === "1";
  } catch {
    queryStream = false;
  }
  const wantStream = parsed.data.stream === true || queryStream;

  const cacheKey = createHash("sha256")
    .update(`${sourceLanguage ?? language}:${language}:${text}`)
    .digest("hex");

  const canSunbirdLg = language === "lg" && isSunbirdConfigured();
  const canGeminiLg = language === "lg" && isGeminiTtsConfigured() && sourceLanguage !== "en";
  const canGeminiEn = language === "en" && isGeminiTtsConfigured();

  const canStreamWithGemini =
    wantStream &&
    (language === "en"
      ? canGeminiEn
      : canGeminiLg && (cfg.lugandaPrimary === "gemini" || !canSunbirdLg));

  if (canStreamWithGemini) {
    const cached = await getCachedVoiceClip(cacheKey, cfg.cacheTtlMs);
    if (cached) {
      return new Response(
        cached.audio,
        mergeRateLimitHeaders(
          {
            status: 200,
            headers: {
              "Content-Type": safeAudioHeaderType(cached.contentType),
              "Cache-Control": "no-store",
              "X-Voice-Cache": "HIT",
            },
          },
          rateLimitHeaders(limitResult),
        ),
      );
    }

    if (inflightSynthesis.size + activeStreamSynthesisCount >= cfg.maxInflight) {
      console.warn("[voice] action blocked action=speak code=TOO_MANY_INFLIGHT");
      return errorResponse("VOICE_BUSY", "Voice service is busy right now", 503);
    }

    const overBudget = await reserveVoiceCall("speak");
    if (overBudget) {
      return overBudget;
    }

    const streamController = new AbortController();
    const streamTimeout = setTimeout(() => streamController.abort(), cfg.timeoutMs);
    const onRequestAbort = () => streamController.abort();
    if (request.signal.aborted) {
      streamController.abort();
    } else {
      request.signal.addEventListener("abort", onRequestAbort, { once: true });
    }

    activeStreamSynthesisCount += 1;
    let streamDecremented = false;
    const releaseStreamSlot = () => {
      if (streamDecremented) return;
      streamDecremented = true;
      activeStreamSynthesisCount = Math.max(0, activeStreamSynthesisCount - 1);
      clearTimeout(streamTimeout);
      request.signal.removeEventListener("abort", onRequestAbort);
    };

    try {
      const iterator = streamGeminiNeuralSpeech(text, language, streamController.signal)[
        Symbol.asyncIterator
      ]();
      let firstStep: IteratorResult<{ pcmBytes: Uint8Array; sampleRate: number }>;
      try {
        firstStep = await iterator.next();
      } catch (firstErr) {
        void iterator.return?.().catch(() => {});
        throw firstErr;
      }

      if (firstStep.done || !firstStep.value || firstStep.value.pcmBytes.byteLength === 0) {
        void iterator.return?.().catch(() => {});
        throw new Error("GEMINI_TTS_EMPTY_STREAM");
      }

      const firstChunk = firstStep.value;
      const collectedChunks: Uint8Array[] = [firstChunk.pcmBytes];
      const streamSampleRate = firstChunk.sampleRate;

      const bodyStream = new ReadableStream<Uint8Array>({
        start(readableController) {
          readableController.enqueue(firstChunk.pcmBytes);
        },
        async pull(readableController) {
          try {
            const next = await iterator.next();
            if (next.done) {
              releaseStreamSlot();
              readableController.close();
              const merged = concatPcmChunks(collectedChunks);
              if (merged.byteLength > 0) {
                const compact = downsamplePcm16Mono(merged, streamSampleRate);
                const wavAudio = pcm16ToWav(compact.pcmBytes, compact.sampleRate);
                void setCachedVoiceClip(
                  cacheKey,
                  { audio: wavAudio, contentType: "audio/wav" },
                  cfg.cacheTtlMs,
                ).catch(() => {});
              }
              return;
            }
            if (next.value.pcmBytes.byteLength > 0) {
              collectedChunks.push(next.value.pcmBytes);
              readableController.enqueue(next.value.pcmBytes);
            }
          } catch (pullErr) {
            releaseStreamSlot();
            readableController.error(pullErr);
          }
        },
        cancel() {
          streamController.abort();
          releaseStreamSlot();
          void iterator.return?.().catch(() => {});
        },
      });

      return new Response(
        bodyStream,
        mergeRateLimitHeaders(
          {
            status: 200,
            headers: {
              "Content-Type": `audio/L16;rate=${streamSampleRate};channels=1`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
              "X-Voice-Cache": "MISS",
              "X-Voice-Provider": "gemini",
            },
          },
          rateLimitHeaders(limitResult),
        ),
      );
    } catch (streamError) {
      // If Gemini fails before emitting byte 1 for Luganda and Sunbird is configured,
      // fall back seamlessly to Sunbird Luganda TTS so Luganda speech still succeeds.
      if (language === "lg" && canSunbirdLg && !streamController.signal.aborted) {
        try {
          const fallbackBudget = await reserveVoiceCall("speak");
          if (fallbackBudget) {
            releaseStreamSlot();
            return fallbackBudget;
          }
          const fallbackAudio = await synthesizeSunbirdSpeech(
            text,
            "lg",
            streamController.signal,
            sourceLanguage,
          );
          releaseStreamSlot();
          await setCachedVoiceClip(cacheKey, fallbackAudio, cfg.fallbackCacheTtlMs);
          return new Response(
            fallbackAudio.audio,
            mergeRateLimitHeaders(
              {
                status: 200,
                headers: {
                  "Content-Type": safeAudioHeaderType(fallbackAudio.contentType),
                  "Cache-Control": "no-store",
                  "X-Voice-Cache": "MISS",
                  "X-Voice-Provider": "sunbird",
                },
              },
              rateLimitHeaders(limitResult),
            ),
          );
        } catch (sunbirdErr) {
          releaseStreamSlot();
          const code =
            sunbirdErr instanceof Error ? sunbirdErr.message.replace(/[^\w:.-]/g, "") : "UNKNOWN";
          console.error(`[voice] action failed action=speak lang=${language} code=${code}`);
          return errorResponse("VOICE_SYNTHESIS_FAILED", "Unable to generate speech right now", 502);
        }
      }

      releaseStreamSlot();
      const code =
        streamError instanceof Error ? streamError.message.replace(/[^\w:.-]/g, "") : "UNKNOWN";
      console.error(`[voice] action failed action=speak lang=${language} code=${code}`);
      return errorResponse("VOICE_SYNTHESIS_FAILED", "Unable to generate speech right now", 502);
    }
  }

  const existingInflight = inflightSynthesis.get(cacheKey);
  if (existingInflight) {
    try {
      const shared = await existingInflight;
      if (shared.kind === "blocked") {
        return shared.response.clone();
      }
      const headers: Record<string, string> = {
        "Content-Type": safeAudioHeaderType(shared.data.contentType),
        "Cache-Control": "no-store",
        "X-Voice-Cache": "HIT",
      };
      if (shared.provider) {
        headers["X-Voice-Provider"] = shared.provider;
      }
      return new Response(
        shared.data.audio,
        mergeRateLimitHeaders({ status: 200, headers }, rateLimitHeaders(limitResult)),
      );
    } catch {
      return errorResponse("VOICE_SYNTHESIS_FAILED", "Unable to generate speech right now", 502);
    }
  }

  if (inflightSynthesis.size + activeStreamSynthesisCount >= cfg.maxInflight) {
    console.warn("[voice] action blocked action=speak code=TOO_MANY_INFLIGHT");
    return errorResponse("VOICE_BUSY", "Voice service is busy right now", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const task = (async (): Promise<InflightSpeakOutcome> => {
    const cached = await getCachedVoiceClip(cacheKey, cfg.cacheTtlMs);
    if (cached) {
      return { kind: "ok", data: cached, cached: true };
    }

    if (language === "lg" && !canSunbirdLg && !canGeminiLg) {
      return {
        kind: "blocked",
        response: errorResponse("VOICE_UNAVAILABLE", "Luganda neural voice is not configured", 503),
      };
    }
    if (language === "en" && !canGeminiEn) {
      return {
        kind: "blocked",
        response: errorResponse("VOICE_UNAVAILABLE", "English neural voice is not configured", 503),
      };
    }

    const overBudget = await reserveVoiceCall("speak");
    if (overBudget) {
      return { kind: "blocked", response: overBudget };
    }
    if (language === "lg") {
      const lg = await synthesizeLugandaWithFallback(
        text,
        controller.signal,
        sourceLanguage,
        canSunbirdLg,
        canGeminiLg,
        cfg,
      );
      if (lg.kind === "blocked") {
        return lg;
      }
      await setCachedVoiceClip(cacheKey, lg.data, lg.ttlMs);
      return { kind: "ok", data: lg.data, provider: lg.provider, cached: false };
    }
    const result = await synthesizeEnglishNeuralSpeech(text, controller.signal);
    await setCachedVoiceClip(cacheKey, result, cfg.cacheTtlMs);
    return { kind: "ok", data: result, provider: "gemini", cached: false };
  })();
  inflightSynthesis.set(cacheKey, task);

  try {
    const outcome = await task;
    if (outcome.kind === "blocked") {
      return outcome.response.clone();
    }
    const synthesized = outcome.data;
    const headers: Record<string, string> = {
      "Content-Type": safeAudioHeaderType(synthesized.contentType),
      "Cache-Control": "no-store",
      "X-Voice-Cache": outcome.cached ? "HIT" : "MISS",
    };
    if (outcome.provider) {
      headers["X-Voice-Provider"] = outcome.provider;
    }

    return new Response(
      synthesized.audio,
      mergeRateLimitHeaders({ status: 200, headers }, rateLimitHeaders(limitResult)),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/[^\w:.-]/g, "") : "UNKNOWN";
    console.error(`[voice] action failed action=speak lang=${language} code=${code}`);
    return errorResponse("VOICE_SYNTHESIS_FAILED", "Unable to generate speech right now", 502);
  } finally {
    inflightSynthesis.delete(cacheKey);
    clearTimeout(timeout);
  }
}
