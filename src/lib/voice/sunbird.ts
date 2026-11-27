import { compactWavBufferTo12kHz } from "@/lib/voice/gemini-tts";
import { normalizeLugandaForSpeech } from "@/lib/voice/luganda-speech";

const DEFAULT_VOICE_API_BASE = "https://api.sunbird.ai";
const SAFE_AUDIO_CONTENT_TYPE =
  /^audio\/[a-z0-9.+-]+(?:;[ \t]*[a-z0-9.+-]+=[a-z0-9.+-]+)*$/i;

function getMaxAudioBytes(): number {
  const parsed = Number(process.env.VOICE_MAX_AUDIO_BYTES);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 16_777_216
    ? parsed
    : 4_194_304;
}

export function normalizeSafeAudioContentType(
  raw: string | null | undefined,
  fallback: string,
): string {
  const candidate = (raw ?? "").trim();
  if (
    candidate.length > 0 &&
    candidate.length <= 128 &&
    SAFE_AUDIO_CONTENT_TYPE.test(candidate)
  ) {
    return candidate;
  }
  return fallback;
}

async function readBoundedAudioBuffer(response: Response): Promise<ArrayBuffer> {
  const maxBytes = getMaxAudioBytes();
  const declaredLen = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    throw new Error("VOICE_TTS_AUDIO_TOO_LARGE");
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error("VOICE_TTS_AUDIO_TOO_LARGE");
    }
    return buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error("VOICE_TTS_AUDIO_TOO_LARGE");
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const candidate = raw?.trim() || fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return fallback;
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function getSunbirdApiBaseUrl(): string {
  return normalizeBaseUrl(
    process.env.VOICE_API_BASE_URL ?? process.env.SUNBIRD_API_BASE_URL,
    DEFAULT_VOICE_API_BASE,
  );
}

export function getSunbirdApiToken(): string | undefined {
  return (
    process.env.VOICE_API_TOKEN?.trim() ||
    process.env.SUNBIRD_API_TOKEN?.trim() ||
    undefined
  );
}

export function isSunbirdConfigured(): boolean {
  return Boolean(getSunbirdApiToken());
}

export interface SynthesizedAudio {
  audio: ArrayBuffer;
  contentType: string;
}

function getAllowedAudioHosts(): Set<string> {
  const hosts = new Set<string>(["storage.googleapis.com"]);
  try {
    hosts.add(new URL(getSunbirdApiBaseUrl()).hostname);
  } catch {
    // Ignore malformed base URL
  }
  const extra = (
    process.env.VOICE_ALLOWED_AUDIO_HOSTS ??
    process.env.SUNBIRD_ALLOWED_AUDIO_HOSTS ??
    ""
  ).split(",");
  for (const host of extra) {
    const cleaned = host.trim().toLowerCase();
    if (cleaned) hosts.add(cleaned);
  }
  return hosts;
}

function isAllowedAudioUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && getAllowedAudioHosts().has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function getConfiguredVoice(language: "en" | "lg"): string | undefined {
  return language === "lg"
    ? process.env.VOICE_SPEAKER_LG?.trim() || process.env.SUNBIRD_LUGANDA_VOICE?.trim() || undefined
    : process.env.VOICE_SPEAKER_EN?.trim() || process.env.SUNBIRD_ENGLISH_VOICE?.trim() || undefined;
}

function isLugandaRewriteEnabled(): boolean {
  return process.env.VOICE_REWRITE_LUGANDA?.trim().toLowerCase() === "true";
}

export async function translateText(
  text: string,
  targetLanguage: "lg" | "en",
  sourceLanguage?: "lg" | "en",
  signal?: AbortSignal,
): Promise<string> {
  const token = getSunbirdApiToken();
  if (!token) {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
  }

  const baseUrl = getSunbirdApiBaseUrl();
  const body: Record<string, string> = {
    target_language: targetLanguage === "lg" ? "lug" : "eng",
    text: text.trim(),
  };
  if (sourceLanguage) {
    body.source_language = sourceLanguage === "lg" ? "lug" : "eng";
  }

  const response = await fetch(`${baseUrl}/tasks/translate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`VOICE_TRANSLATE_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as {
    output?: { translated_text?: string };
    translated_text?: string;
  };
  const translated = payload.output?.translated_text?.trim() || payload.translated_text?.trim();
  if (!translated) {
    throw new Error("VOICE_TRANSLATE_EMPTY");
  }
  return translated;
}

export async function translateToLuganda(
  text: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    return await translateText(text, "lg", undefined, signal);
  } catch {
    return text;
  }
}

export async function synthesizeSunbirdSpeech(
  text: string,
  language: "en" | "lg",
  signal?: AbortSignal,
  sourceLanguage?: "en" | "lg",
): Promise<SynthesizedAudio> {
  const token = getSunbirdApiToken();
  if (!token) {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
  }

  let preparedText = text.trim();
  if (language === "lg") {
    const shouldTranslate = sourceLanguage === "en" || isLugandaRewriteEnabled();
    if (shouldTranslate) {
      try {
        preparedText = await translateText(preparedText, "lg", sourceLanguage, signal);
      } catch {
        // Keep original text if optional rewrite fails or times out
      }
    }
    preparedText = normalizeLugandaForSpeech(preparedText);
  }

  const baseUrl = getSunbirdApiBaseUrl();
  const configuredVoice = getConfiguredVoice(language);
  const dynamicMaxTokens = Math.min(1200, Math.max(220, preparedText.length * 5));
  const requestBody: Record<string, unknown> = {
    text: preparedText,
    language: language === "lg" ? "lug" : "eng",
    response_mode: "stream",
    temperature: 0.25,
    top_p: 0.9,
    repetition_penalty: 1.1,
    max_tokens: dynamicMaxTokens,
  };
  if (configuredVoice) {
    requestBody.voice = configuredVoice;
  }

  const response = await fetch(`${baseUrl}/tasks/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    redirect: "error",
    signal,
  });

  if (!response.ok) {
    throw new Error(`VOICE_TTS_HTTP_${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("audio/") || contentType.startsWith("application/octet-stream")) {
    const rawAudio = await readBoundedAudioBuffer(response);
    if (rawAudio.byteLength === 0) {
      throw new Error("VOICE_TTS_EMPTY_AUDIO");
    }
    const normalizedType = normalizeSafeAudioContentType(
      contentType.startsWith("audio/") ? contentType : "audio/wav",
      "audio/wav",
    );
    const audio = normalizedType.toLowerCase().includes("wav")
      ? compactWavBufferTo12kHz(rawAudio)
      : rawAudio;
    return {
      audio,
      contentType: normalizedType,
    };
  }

  const payload = (await response.json()) as {
    output?: { audio_url?: string };
    audio_url?: string;
    url?: string;
  };
  const audioUrl = payload.output?.audio_url ?? payload.audio_url ?? payload.url;
  if (!audioUrl || !isAllowedAudioUrl(audioUrl)) {
    throw new Error("VOICE_TTS_INVALID_AUDIO_URL");
  }

  const audioResponse = await fetch(audioUrl, { signal, redirect: "error" });
  if (!audioResponse.ok) {
    throw new Error(`VOICE_AUDIO_FETCH_HTTP_${audioResponse.status}`);
  }

  const fetchedType = normalizeSafeAudioContentType(
    audioResponse.headers.get("content-type"),
    "audio/mpeg",
  );
  const fetchedBytes = await readBoundedAudioBuffer(audioResponse);
  if (fetchedBytes.byteLength === 0) {
    throw new Error("VOICE_TTS_EMPTY_AUDIO");
  }
  return {
    audio: fetchedType.toLowerCase().includes("wav")
      ? compactWavBufferTo12kHz(fetchedBytes)
      : fetchedBytes,
    contentType: fetchedType,
  };
}

export async function synthesizeLugandaSpeech(
  text: string,
  signal?: AbortSignal,
): Promise<SynthesizedAudio> {
  return synthesizeSunbirdSpeech(text, "lg", signal);
}

export async function transcribeLugandaAudio(
  audioBlob: Blob,
  fileName: string,
  signal?: AbortSignal,
): Promise<string> {
  const token = getSunbirdApiToken();
  if (!token) {
    throw new Error("VOICE_PROVIDER_NOT_CONFIGURED");
  }

  const baseUrl = getSunbirdApiBaseUrl();
  const formData = new FormData();
  formData.append("audio", audioBlob, fileName || "voice.webm");
  formData.append("language", "lug");

  const response = await fetch(`${baseUrl}/tasks/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`VOICE_STT_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as {
    output?: { text?: string; audio_transcription?: string };
    text?: string;
    audio_transcription?: string;
  };

  const transcript =
    payload.output?.text ??
    payload.output?.audio_transcription ??
    payload.text ??
    payload.audio_transcription ??
    "";

  return transcript.trim();
}
