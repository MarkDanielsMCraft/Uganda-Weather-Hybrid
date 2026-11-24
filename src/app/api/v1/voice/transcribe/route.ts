import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { mergeRateLimitHeaders, rejectCrossSiteRequest } from "@/lib/api/route-utils";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { isSunbirdConfigured, transcribeLugandaAudio } from "@/lib/voice/sunbird";

export const maxDuration = 60;

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

const VOICE_STT_RATE_LIMIT = readPositiveInt(process.env.VOICE_STT_RATE_LIMIT, 15, 200);
const VOICE_WINDOW_MS = readPositiveInt(process.env.VOICE_RATE_WINDOW_MS, 60_000, 3_600_000);
const MAX_AUDIO_BYTES = readPositiveInt(process.env.VOICE_MAX_AUDIO_BYTES, 4 * 1024 * 1024, 10 * 1024 * 1024);
const VOICE_TIMEOUT_MS = readPositiveInt(process.env.VOICE_TIMEOUT_MS, 45_000, 58_000);

export async function POST(request: Request) {
  const crossSite = rejectCrossSiteRequest(request, "voice");
  if (crossSite) return crossSite;

  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(
    `voice:transcribe:${ip}`,
    VOICE_STT_RATE_LIMIT,
    VOICE_WINDOW_MS,
  );
  if (!limitResult.allowed) {
    console.warn("[voice] action blocked action=transcribe code=RATE_LIMITED");
    return errorResponse("RATE_LIMITED", "Too many transcription requests", 429, {
      resetAt: limitResult.resetAt,
    });
  }

  if (!isSunbirdConfigured()) {
    return errorResponse("STT_UNAVAILABLE", "Luganda transcription is not configured", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    console.warn("[voice] action blocked action=transcribe code=INVALID_FORM");
    return errorResponse("BAD_REQUEST", "Expected multipart form data with an audio file", 400);
  }

  const audioEntry = formData.get("audio");
  if (!(audioEntry instanceof Blob) || audioEntry.size === 0) {
    console.warn("[voice] action blocked action=transcribe code=MISSING_AUDIO");
    return errorResponse("BAD_REQUEST", "Audio file is required", 400);
  }

  if (audioEntry.size > MAX_AUDIO_BYTES) {
    console.warn("[voice] action blocked action=transcribe code=AUDIO_TOO_LARGE");
    return errorResponse("PAYLOAD_TOO_LARGE", "Audio clip must be under 4 MB", 413);
  }

  const fileName =
    audioEntry instanceof File && audioEntry.name ? audioEntry.name : "voice.webm";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

  try {
    const text = await transcribeLugandaAudio(audioEntry, fileName, controller.signal);
    return jsonResponse(
      { text, language: "lg" as const },
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
    console.error(`[voice] action failed action=transcribe lang=lg code=${code}`);
    return errorResponse("VOICE_TRANSCRIPTION_FAILED", "Unable to transcribe audio right now", 502);
  } finally {
    clearTimeout(timeout);
  }
}
