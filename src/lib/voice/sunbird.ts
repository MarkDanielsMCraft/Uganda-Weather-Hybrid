import { normalizeLugandaForSpeech } from "@/lib/voice/luganda-speech";

const DEFAULT_VOICE_API_BASE = "https://api.sunbird.ai";

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

export function isEnglishCloudVoiceEnabled(): boolean {
  return process.env.VOICE_ENGLISH_CLOUD_ENABLED?.trim().toLowerCase() === "true";
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
    signal,
  });

  if (!response.ok) {
    throw new Error(`VOICE_TTS_HTTP_${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("audio/") || contentType.startsWith("application/octet-stream")) {
    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0) {
      throw new Error("VOICE_TTS_EMPTY_AUDIO");
    }
    return {
      audio,
      contentType: contentType.startsWith("audio/") ? contentType : "audio/wav",
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

  const audioResponse = await fetch(audioUrl, { signal });
  if (!audioResponse.ok) {
    throw new Error(`VOICE_AUDIO_FETCH_HTTP_${audioResponse.status}`);
  }

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get("content-type") || "audio/mpeg",
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
