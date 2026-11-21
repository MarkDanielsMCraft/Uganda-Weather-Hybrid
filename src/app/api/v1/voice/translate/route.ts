import { createHash } from "node:crypto";
import { z } from "zod";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { isSunbirdConfigured, translateText } from "@/lib/voice/sunbird";

export const maxDuration = 30;

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

const VOICE_TRANSLATE_RATE_LIMIT = readPositiveInt(process.env.VOICE_TRANSLATE_RATE_LIMIT, 25, 200);
const VOICE_WINDOW_MS = readPositiveInt(process.env.VOICE_RATE_WINDOW_MS, 60_000, 3_600_000);
const VOICE_MAX_TRANSLATE_CHARS = readPositiveInt(process.env.VOICE_MAX_TRANSLATE_CHARS, 1200, 4000);
const VOICE_TIMEOUT_MS = readPositiveInt(process.env.VOICE_TIMEOUT_MS, 20_000, 29_000);
const TRANSLATE_CACHE_TTL_MS = readPositiveInt(process.env.VOICE_TRANSLATE_CACHE_TTL_MS, 3_600_000, 86_400_000);
const MAX_CACHED_TRANSLATIONS = 100;

interface CachedTranslationEntry {
  text: string;
  expiresAt: number;
}

const translationCache = new Map<string, CachedTranslationEntry>();

function getCachedTranslation(key: string): string | null {
  const entry = translationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    translationCache.delete(key);
    return null;
  }
  return entry.text;
}

function setCachedTranslation(key: string, text: string): void {
  if (translationCache.size >= MAX_CACHED_TRANSLATIONS) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
  translationCache.set(key, { text, expiresAt: Date.now() + TRANSLATE_CACHE_TTL_MS });
}

const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(VOICE_MAX_TRANSLATE_CHARS),
  targetLanguage: z.enum(["lg", "en"]),
  sourceLanguage: z.enum(["lg", "en"]).optional(),
});

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(
    `voice:translate:${ip}`,
    VOICE_TRANSLATE_RATE_LIMIT,
    VOICE_WINDOW_MS,
  );
  if (!limitResult.allowed) {
    console.warn("[voice] action blocked action=translate code=RATE_LIMITED");
    return errorResponse("RATE_LIMITED", "Too many translation requests", 429, {
      resetAt: limitResult.resetAt,
    });
  }

  if (!isSunbirdConfigured()) {
    return errorResponse("TRANSLATION_UNAVAILABLE", "Luganda translation is not configured", 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    console.warn("[voice] action blocked action=translate code=INVALID_JSON");
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = translateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.warn("[voice] action blocked action=translate code=VALIDATION_FAILED");
    return errorResponse("BAD_REQUEST", "Invalid translation request payload", 400);
  }

  const { text, targetLanguage, sourceLanguage } = parsed.data;
  const cacheKey = createHash("sha256")
    .update(`${sourceLanguage ?? "auto"}:${targetLanguage}:${text}`)
    .digest("hex");
  const cached = getCachedTranslation(cacheKey);
  if (cached) {
    return jsonResponse(
      { text: cached, language: targetLanguage },
      createMeta(true),
      mergeRateLimitHeaders(
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
        rateLimitHeaders(limitResult),
      ),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

  try {
    const translated = await translateText(text, targetLanguage, sourceLanguage, controller.signal);
    setCachedTranslation(cacheKey, translated);
    return jsonResponse(
      { text: translated, language: targetLanguage },
      createMeta(false),
      mergeRateLimitHeaders(
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
        rateLimitHeaders(limitResult),
      ),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/[^\w:.-]/g, "") : "UNKNOWN";
    console.error(`[voice] action failed action=translate target=${targetLanguage} code=${code}`);
    return errorResponse("TRANSLATION_FAILED", "Unable to translate text right now", 502);
  } finally {
    clearTimeout(timeout);
  }
}
