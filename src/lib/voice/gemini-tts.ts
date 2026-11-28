import { normalizeLugandaForSpeech } from "@/lib/voice/luganda-speech";
import type { SynthesizedAudio } from "@/lib/voice/sunbird";

const DEFAULT_GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
const DEFAULT_GEMINI_LUGANDA_TTS_MODEL = "gemini-3.8-flash-tts";
const DEFAULT_GEMINI_TTS_VOICE = "Kore";
const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_COMPACT_SAMPLE_RATE = 12_000;
const DEFAULT_MIN_BYTES_FOR_DOWNSAMPLE = 4_800;
const VALID_LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const VALID_MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const SAFE_AUDIO_CONTENT_TYPE =
  /^audio\/[a-z0-9.+-]+(?:;[ \t]*[a-z0-9.+-]+=[a-z0-9.+-]+)*$/i;

function sanitizeGeminiModelName(raw: string | undefined, fallback: string): string {
  const stripped = (raw ?? "").trim().replace(/^models\//i, "");
  return VALID_MODEL_NAME.test(stripped) ? stripped : fallback;
}

function getMaxInlineBase64Chars(): number {
  const parsed = Number(process.env.VOICE_MAX_AUDIO_BYTES);
  const maxBytes =
    Number.isInteger(parsed) && parsed > 0 && parsed <= 16_777_216 ? parsed : 4_194_304;
  return Math.ceil((maxBytes * 4) / 3) + 64;
}

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

function getAudioCompactionConfig() {
  const configuredRate = Number(process.env.VOICE_COMPACT_SAMPLE_RATE);
  const compactSampleRate =
    configuredRate === 24_000 || configuredRate === 12_000
      ? configuredRate
      : DEFAULT_COMPACT_SAMPLE_RATE;
  const minBytesForDownsample = readPositiveInt(
    process.env.VOICE_MIN_BYTES_FOR_DOWNSAMPLE,
    DEFAULT_MIN_BYTES_FOR_DOWNSAMPLE,
    1_048_576,
  );
  return { compactSampleRate, minBytesForDownsample };
}

export function downsamplePcm16Mono(
  pcmBytes: Uint8Array,
  fromRate: number,
  toRate = getAudioCompactionConfig().compactSampleRate,
): { pcmBytes: Uint8Array; sampleRate: number } {
  const { minBytesForDownsample } = getAudioCompactionConfig();
  if (
    fromRate !== 24_000 ||
    toRate !== 12_000 ||
    pcmBytes.byteLength < minBytesForDownsample
  ) {
    return { pcmBytes, sampleRate: fromRate };
  }

  const usableBytes = pcmBytes.byteLength - (pcmBytes.byteLength % 2);
  const sampleCount = usableBytes / 2;
  const outSamples = Math.floor(sampleCount / 2);
  if (outSamples <= 0) {
    return { pcmBytes, sampleRate: fromRate };
  }

  const inView = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, usableBytes);
  const outBuffer = new ArrayBuffer(outSamples * 2);
  const outView = new DataView(outBuffer);

  for (let i = 0; i < outSamples; i += 1) {
    const s0 = inView.getInt16(i * 4, true);
    const s1 = inView.getInt16(i * 4 + 2, true);
    outView.setInt16(i * 2, (s0 + s1) >> 1, true);
  }

  return {
    pcmBytes: new Uint8Array(outBuffer),
    sampleRate: toRate,
  };
}

export function getGeminiTtsApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function isGeminiTtsConfigured(): boolean {
  return Boolean(getGeminiTtsApiKey());
}

function getGeminiTtsConfig() {
  const rawBase = process.env.GEMINI_API_BASE_URL?.trim() || DEFAULT_GEMINI_API_BASE;
  let baseUrl = DEFAULT_GEMINI_API_BASE;
  try {
    const parsed = new URL(rawBase);
    if (parsed.protocol === "https:") {
      baseUrl = parsed.origin + parsed.pathname.replace(/\/+$/, "");
    }
  } catch {
    baseUrl = DEFAULT_GEMINI_API_BASE;
  }

  const englishVoice = process.env.GEMINI_TTS_VOICE?.trim() || DEFAULT_GEMINI_TTS_VOICE;
  const lugandaVoice = process.env.GEMINI_LUGANDA_TTS_VOICE?.trim() || englishVoice;
  const rawEnLang = process.env.GEMINI_ENGLISH_LANGUAGE_CODE?.trim() ?? "";
  const rawLgLang = process.env.GEMINI_LUGANDA_LANGUAGE_CODE?.trim() ?? "";

  return {
    baseUrl,
    model: sanitizeGeminiModelName(process.env.GEMINI_TTS_MODEL, DEFAULT_GEMINI_TTS_MODEL),
    lugandaModel: sanitizeGeminiModelName(
      process.env.GEMINI_LUGANDA_TTS_MODEL,
      DEFAULT_GEMINI_LUGANDA_TTS_MODEL,
    ),
    voice: englishVoice,
    lugandaVoice,
    englishLanguageCode: VALID_LANGUAGE_CODE.test(rawEnLang) ? rawEnLang : "en-US",
    lugandaLanguageCode: VALID_LANGUAGE_CODE.test(rawLgLang) ? rawLgLang : "lg",
  };
}

export function pcm16ToWav(pcmBytes: Uint8Array, sampleRate = DEFAULT_SAMPLE_RATE): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcmBytes);
  return buffer;
}

/**
 * Compacts 24 kHz 16-bit mono RIFF/WAV speech buffers down to the configured
 * compact sample rate (default 12 kHz), halving mobile data transfer and
 * normalizing streaming WAV header lengths.
 */
export function compactWavBufferTo12kHz(audio: ArrayBuffer): ArrayBuffer {
  const { compactSampleRate, minBytesForDownsample } = getAudioCompactionConfig();
  if (compactSampleRate !== 12_000 || audio.byteLength < 44 + minBytesForDownsample) {
    return audio;
  }
  const view = new DataView(audio);
  const magic = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (magic(0) !== "RIFF" || magic(8) !== "WAVE") return audio;

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= audio.byteLength) {
    const chunkId = magic(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkBody = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16 && chunkBody + 16 <= audio.byteLength) {
      audioFormat = view.getUint16(chunkBody, true);
      channels = view.getUint16(chunkBody + 2, true);
      sampleRate = view.getUint32(chunkBody + 4, true);
      bitsPerSample = view.getUint16(chunkBody + 14, true);
    } else if (chunkId === "data") {
      dataOffset = chunkBody;
      dataLength = Math.min(chunkSize, audio.byteLength - chunkBody);
      break;
    }
    const padded = chunkSize + (chunkSize % 2);
    if (padded < 0 || chunkBody + padded > audio.byteLength) break;
    offset = chunkBody + padded;
  }

  if (
    audioFormat !== 1 ||
    channels !== 1 ||
    sampleRate !== 24_000 ||
    bitsPerSample !== 16 ||
    dataOffset < 0 ||
    dataLength < minBytesForDownsample
  ) {
    return audio;
  }

  const pcmBytes = new Uint8Array(audio, dataOffset, dataLength);
  const compact = downsamplePcm16Mono(pcmBytes, 24_000, compactSampleRate);
  return pcm16ToWav(compact.pcmBytes, compact.sampleRate);
}

function decodeInlineGeminiAudio(inline: { data: string; mimeType?: string }): SynthesizedAudio {
  if (inline.data.length > getMaxInlineBase64Chars()) {
    throw new Error("GEMINI_TTS_AUDIO_TOO_LARGE");
  }
  const rawBytes = Uint8Array.from(Buffer.from(inline.data, "base64"));
  const mimeType = (inline.mimeType ?? "audio/L16;rate=24000").trim();
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime.startsWith("audio/l16") || lowerMime.startsWith("audio/pcm")) {
    const rateMatch = /rate=(\d+)/i.exec(mimeType);
    const parsedRate = rateMatch ? Number(rateMatch[1]) : DEFAULT_SAMPLE_RATE;
    const validRate =
      Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : DEFAULT_SAMPLE_RATE;
    const compact = downsamplePcm16Mono(rawBytes, validRate);
    return {
      audio: pcm16ToWav(compact.pcmBytes, compact.sampleRate),
      contentType: "audio/wav",
    };
  }

  const rawBuffer = rawBytes.buffer.slice(
    rawBytes.byteOffset,
    rawBytes.byteOffset + rawBytes.byteLength,
  );
  if (lowerMime.includes("wav")) {
    return {
      audio: compactWavBufferTo12kHz(rawBuffer),
      contentType: "audio/wav",
    };
  }

  const safeType =
    mimeType.length > 0 && mimeType.length <= 128 && SAFE_AUDIO_CONTENT_TYPE.test(mimeType)
      ? mimeType
      : "audio/wav";
  return {
    audio: rawBuffer,
    contentType: safeType,
  };
}

export async function synthesizeEnglishNeuralSpeech(
  text: string,
  signal?: AbortSignal,
): Promise<SynthesizedAudio> {
  const apiKey = getGeminiTtsApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_TTS_NOT_CONFIGURED");
  }

  const { baseUrl, model, voice, englishLanguageCode } = getGeminiTtsConfig();
  const endpoint = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const spokenText = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<<<|>>>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spokenText) {
    throw new Error("GEMINI_TTS_EMPTY_TEXT");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: spokenText,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: englishLanguageCode,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    }),
    redirect: "error",
    signal,
  });

  if (!response.ok) {
    throw new Error(`GEMINI_TTS_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }>;
      };
    }>;
  };

  const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    throw new Error("GEMINI_TTS_EMPTY_AUDIO");
  }

  return decodeInlineGeminiAudio({ data: inline.data, mimeType: inline.mimeType });
}

/**
 * Synthesizes natural Luganda (Ganda) speech using the configured Gemini
 * Luganda TTS model (`GEMINI_LUGANDA_TTS_MODEL`). Passes only the normalized
 * Luganda sentence in `contents` so no prompt wrapper is spoken aloud.
 */
export async function synthesizeLugandaNeuralSpeech(
  text: string,
  signal?: AbortSignal,
): Promise<SynthesizedAudio> {
  const apiKey = getGeminiTtsApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_TTS_NOT_CONFIGURED");
  }

  const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim();
  const spokenLuganda = normalizeLugandaForSpeech(sanitized);
  if (!spokenLuganda) {
    throw new Error("GEMINI_TTS_EMPTY_TEXT");
  }

  const { baseUrl, lugandaModel, lugandaVoice, lugandaLanguageCode } = getGeminiTtsConfig();
  const endpoint = `${baseUrl}/v1beta/models/${encodeURIComponent(lugandaModel)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: spokenLuganda,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: lugandaLanguageCode,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: lugandaVoice,
            },
          },
        },
      },
    }),
    redirect: "error",
    signal,
  });

  if (!response.ok) {
    throw new Error(`GEMINI_TTS_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }>;
      };
    }>;
  };

  const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    throw new Error("GEMINI_TTS_EMPTY_AUDIO");
  }

  return decodeInlineGeminiAudio({ data: inline.data, mimeType: inline.mimeType });
}

export interface GeminiPcmChunk {
  pcmBytes: Uint8Array;
  sampleRate: number;
}

/**
 * Streams raw 16-bit mono PCM chunks (`audio/l16`) from Gemini SSE for an
 * entire English or normalized Luganda text in one request so the browser
 * starts speaking in ~0.6s (English) or ~1.4s (Luganda).
 */
export async function* streamGeminiNeuralSpeech(
  text: string,
  language: "en" | "lg",
  signal?: AbortSignal,
): AsyncGenerator<GeminiPcmChunk, void, unknown> {
  const apiKey = getGeminiTtsApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_TTS_NOT_CONFIGURED");
  }

  const cfg = getGeminiTtsConfig();
  const isLg = language === "lg";
  const modelName = isLg ? cfg.lugandaModel : cfg.model;
  const voiceName = isLg ? cfg.lugandaVoice : cfg.voice;
  const languageCode = isLg ? cfg.lugandaLanguageCode : cfg.englishLanguageCode;

  let promptText: string;
  if (isLg) {
    const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim();
    promptText = normalizeLugandaForSpeech(sanitized);
    if (!promptText) {
      throw new Error("GEMINI_TTS_EMPTY_TEXT");
    }
  } else {
    promptText = text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/<<<|>>>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!promptText) {
      throw new Error("GEMINI_TTS_EMPTY_TEXT");
    }
  }

  const endpoint = `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    }),
    redirect: "error",
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`GEMINI_TTS_HTTP_${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const maxBytes = Math.floor((getMaxInlineBase64Chars() * 3) / 4);
  let totalBytes = 0;
  let buffer = "";

  const extractChunksFromLine = (line: string): GeminiPcmChunk[] => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return [];
    const rawJson = trimmed.slice(5).trim();
    if (!rawJson || rawJson === "[DONE]") return [];
    let parsed: {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
        };
      }>;
    };
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return [];
    }
    const out: GeminiPcmChunk[] = [];
    const parts = parsed.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (!inline?.data) continue;
      const bytes = Uint8Array.from(Buffer.from(inline.data, "base64"));
      if (bytes.byteLength === 0) continue;
      totalBytes += bytes.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("GEMINI_TTS_AUDIO_TOO_LARGE");
      }
      const mime = inline.mimeType ?? "audio/L16;rate=24000";
      const rateMatch = /rate=(\d+)/i.exec(mime);
      const parsedRate = rateMatch ? Number(rateMatch[1]) : DEFAULT_SAMPLE_RATE;
      const sampleRate =
        Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : DEFAULT_SAMPLE_RATE;
      out.push({ pcmBytes: bytes, sampleRate });
    }
    return out;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        for (const chunk of extractChunksFromLine(line)) {
          yield chunk;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        for (const chunk of extractChunksFromLine(line)) {
          yield chunk;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore reader release errors
    }
  }
}
