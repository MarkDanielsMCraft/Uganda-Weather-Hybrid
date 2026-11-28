import { getRedisClient, redisGetJson, redisSet } from "@/lib/cache/redis";
import type { SynthesizedAudio } from "@/lib/voice/sunbird";

const MAX_CONTENT_TYPE_CHARS = 128;
const ALLOWED_VOICE_CONTENT_TYPES =
  /^audio\/[a-z0-9.+-]+(?:;[ \t]*[a-z0-9.+-]+=[a-z0-9.+-]+)*$/i;
const VALID_REDIS_KEY_PREFIX = /^[a-z0-9:_-]{2,48}$/i;

function readPositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

function getVoiceCacheConfig() {
  const maxMemoryClips = readPositiveInt(process.env.VOICE_MEMORY_MAX_CLIPS, 200, 2_000);
  const maxMemoryTotalBytes = readPositiveInt(
    process.env.VOICE_MEMORY_MAX_BYTES,
    64 * 1024 * 1024,
    256 * 1024 * 1024,
  );
  const maxRedisAudioBytes = readPositiveInt(
    process.env.VOICE_REDIS_MAX_AUDIO_BYTES,
    2 * 1024 * 1024,
    4 * 1024 * 1024,
  );
  const maxRedisBase64Chars = Math.ceil((maxRedisAudioBytes * 4) / 3) + 16;
  const readTimeoutMs = readPositiveInt(process.env.VOICE_REDIS_READ_TIMEOUT_MS, 3_000, 15_000);
  const writeTimeoutMs = readPositiveInt(process.env.VOICE_REDIS_WRITE_TIMEOUT_MS, 5_000, 20_000);
  const rawPrefix = process.env.VOICE_REDIS_KEY_PREFIX?.trim() ?? "";
  const keyPrefix = VALID_REDIS_KEY_PREFIX.test(rawPrefix) ? rawPrefix : "ug:voice:clip:v2:";

  return {
    maxMemoryClips,
    maxMemoryTotalBytes,
    maxRedisAudioBytes,
    maxRedisBase64Chars,
    readTimeoutMs,
    writeTimeoutMs,
    keyPrefix,
  };
}

interface MemoryAudioEntry {
  data: SynthesizedAudio;
  expiresAt: number;
}

interface RedisVoiceClipPayload {
  contentType: string;
  base64: string;
}

const memoryAudioCache = new Map<string, MemoryAudioEntry>();
let memoryAudioBytes = 0;

function isValidVoiceContentType(contentType: unknown): contentType is string {
  return (
    typeof contentType === "string" &&
    contentType.length > 0 &&
    contentType.length <= MAX_CONTENT_TYPE_CHARS &&
    ALLOWED_VOICE_CONTENT_TYPES.test(contentType)
  );
}

function removeMemoryEntry(key: string): void {
  const existing = memoryAudioCache.get(key);
  if (!existing) return;
  memoryAudioCache.delete(key);
  memoryAudioBytes = Math.max(0, memoryAudioBytes - existing.data.audio.byteLength);
}

function readMemoryAudio(key: string): SynthesizedAudio | null {
  const entry = memoryAudioCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    removeMemoryEntry(key);
    return null;
  }
  // Refresh insertion order so frequently requested district briefings stay hot.
  memoryAudioCache.delete(key);
  memoryAudioCache.set(key, entry);
  return entry.data;
}

function writeMemoryAudio(key: string, data: SynthesizedAudio, ttlMs: number): void {
  const cfg = getVoiceCacheConfig();
  const clipBytes = data.audio.byteLength;
  if (clipBytes <= 0 || clipBytes > cfg.maxRedisAudioBytes) {
    return;
  }
  if (memoryAudioCache.has(key)) {
    removeMemoryEntry(key);
  }
  while (
    memoryAudioCache.size > 0 &&
    (memoryAudioCache.size >= cfg.maxMemoryClips ||
      memoryAudioBytes + clipBytes > cfg.maxMemoryTotalBytes)
  ) {
    const oldestKey = memoryAudioCache.keys().next().value;
    if (!oldestKey) break;
    removeMemoryEntry(oldestKey);
  }
  memoryAudioCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  memoryAudioBytes += clipBytes;
}

export async function getCachedVoiceClip(
  key: string,
  fallbackMemoryTtlMs = 1_800_000,
): Promise<SynthesizedAudio | null> {
  const inMemory = readMemoryAudio(key);
  if (inMemory) return inMemory;

  if (!getRedisClient()) return null;

  const cfg = getVoiceCacheConfig();
  try {
    const payload = await redisGetJson<RedisVoiceClipPayload>(
      `${cfg.keyPrefix}${key}`,
      cfg.readTimeoutMs,
    );
    if (
      !payload ||
      typeof payload.base64 !== "string" ||
      payload.base64.length === 0 ||
      payload.base64.length > cfg.maxRedisBase64Chars ||
      !isValidVoiceContentType(payload.contentType)
    ) {
      return null;
    }

    const bytes = Buffer.from(payload.base64, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > cfg.maxRedisAudioBytes) {
      return null;
    }

    const audio = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const clip: SynthesizedAudio = {
      audio,
      contentType: payload.contentType,
    };
    writeMemoryAudio(key, clip, fallbackMemoryTtlMs);
    return clip;
  } catch {
    return null;
  }
}

export async function setCachedVoiceClip(
  key: string,
  data: SynthesizedAudio,
  ttlMs: number,
): Promise<void> {
  const cfg = getVoiceCacheConfig();
  if (
    !isValidVoiceContentType(data.contentType) ||
    data.audio.byteLength <= 0 ||
    data.audio.byteLength > cfg.maxRedisAudioBytes
  ) {
    return;
  }

  writeMemoryAudio(key, data, ttlMs);

  if (!getRedisClient()) return;

  try {
    const payload: RedisVoiceClipPayload = {
      contentType: data.contentType,
      base64: Buffer.from(data.audio).toString("base64"),
    };
    const ttlSeconds = Math.max(60, Math.round(ttlMs / 1000));
    await redisSet(
      `${cfg.keyPrefix}${key}`,
      JSON.stringify(payload),
      ttlSeconds,
      cfg.writeTimeoutMs,
    );
  } catch {
    // Keep serving speech even if shared Redis is temporarily unreachable.
  }
}

export function clearVoiceCacheForTests(): void {
  memoryAudioCache.clear();
  memoryAudioBytes = 0;
}
