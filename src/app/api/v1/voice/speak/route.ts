import { reserveVoiceCall } from "@/lib/voice/voice-budget";
import { createHash } from "node:crypto";
import { z } from "zod";
import { errorResponse } from "@/lib/cache";
import { mergeRateLimitHeaders, rejectCrossSiteRequest } from "@/lib/api/route-utils";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { isGeminiTtsConfigured, synthesizeEnglishNeuralSpeech } from "@/lib/voice/gemini-tts";
import {
  isSunbirdConfigured,
  synthesizeSunbirdSpeech,
  type SynthesizedAudio,
} from "@/lib/voice/sunbird";

export const maxDuration = 60;

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

const VOICE_SPEAK_RATE_LIMIT = readPositiveInt(process.env.VOICE_SPEAK_RATE_LIMIT, 45, 200);
const VOICE_WINDOW_MS = readPositiveInt(process.env.VOICE_RATE_WINDOW_MS, 60_000, 3_600_000);
const VOICE_MAX_TEXT_CHARS = readPositiveInt(process.env.VOICE_MAX_TEXT_CHARS, 1600, 3000);
const VOICE_TIMEOUT_MS = readPositiveInt(process.env.VOICE_TIMEOUT_MS, 45_000, 58_000);
const VOICE_CACHE_TTL_MS = readPositiveInt(process.env.VOICE_CACHE_TTL_MS, 600_000, 3_600_000);
const MAX_CACHED_CLIPS = 40;

interface CachedAudioEntry {
  data: SynthesizedAudio;
  expiresAt: number;
}

const serverAudioCache = new Map<string, CachedAudioEntry>();

function getCachedAudio(key: string): SynthesizedAudio | null {
  const entry = serverAudioCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    serverAudioCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedAudio(key: string, data: SynthesizedAudio): void {
  if (serverAudioCache.size >= MAX_CACHED_CLIPS) {
    const oldestKey = serverAudioCache.keys().next().value;
    if (oldestKey) serverAudioCache.delete(oldestKey);
  }
  serverAudioCache.set(key, { data, expiresAt: Date.now() + VOICE_CACHE_TTL_MS });
}

const speakRequestSchema = z.object({
  text: z.string().trim().min(1).max(VOICE_MAX_TEXT_CHARS),
  language: z.enum(["en", "lg"]),
  sourceLanguage: z.enum(["en", "lg"]).optional(),
});

export async function POST(request: Request) {
  const crossSite = rejectCrossSiteRequest(request, "voice");
  if (crossSite) return crossSite;

  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(
    `voice:speak:${ip}`,
    VOICE_SPEAK_RATE_LIMIT,
    VOICE_WINDOW_MS,
  );
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

  const parsed = speakRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.warn("[voice] action blocked action=speak code=VALIDATION_FAILED");
    return errorResponse("BAD_REQUEST", "Invalid speech request payload", 400);
  }

  const { text, language, sourceLanguage } = parsed.data;
  const cacheKey = createHash("sha256")
    .update(`${sourceLanguage ?? language}:${language}:${text}`)
    .digest("hex");
  const cached = getCachedAudio(cacheKey);
  if (cached) {
    return new Response(
      cached.audio,
      mergeRateLimitHeaders(
        {
          status: 200,
          headers: {
            "Content-Type": cached.contentType,
            "Cache-Control": "no-store",
            "X-Voice-Cache": "HIT",
          },
        },
        rateLimitHeaders(limitResult),
      ),
    );
  }

  const overBudget = await reserveVoiceCall("speak");
  if (overBudget) return overBudget;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

  try {
    let synthesized: SynthesizedAudio;
    if (language === "lg") {
      if (!isSunbirdConfigured()) {
        return errorResponse("VOICE_UNAVAILABLE", "Luganda neural voice is not configured", 503);
      }
      synthesized = await synthesizeSunbirdSpeech(text, "lg", controller.signal, sourceLanguage);
    } else if (isGeminiTtsConfigured()) {
      synthesized = await synthesizeEnglishNeuralSpeech(text, controller.signal);
    } else {
      return errorResponse("VOICE_UNAVAILABLE", "English neural voice is not configured", 503);
    }

    setCachedAudio(cacheKey, synthesized);

    return new Response(
      synthesized.audio,
      mergeRateLimitHeaders(
        {
          status: 200,
          headers: {
            "Content-Type": synthesized.contentType,
            "Cache-Control": "no-store",
            "X-Voice-Cache": "MISS",
          },
        },
        rateLimitHeaders(limitResult),
      ),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/[^\w:.-]/g, "") : "UNKNOWN";
    console.error(`[voice] action failed action=speak lang=${language} code=${code}`);
    return errorResponse("VOICE_SYNTHESIS_FAILED", "Unable to generate speech right now", 502);
  } finally {
    clearTimeout(timeout);
  }
}
