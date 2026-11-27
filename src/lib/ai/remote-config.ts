import {
  fetchAndActivate,
  getBoolean,
  getNumber,
  getRemoteConfig,
  getString,
  isSupported,
  type RemoteConfig,
} from "firebase/remote-config";
import * as firebaseClient from "@/lib/ai/firebase-client";

export interface AdvisorRemoteConfigSnapshot {
  enabled: boolean;
  cloudModel: string;
  maxOutputTokens: number;
  preferOnDevice: boolean;
  ttsEnabled: boolean;
  ttsModel: string;
  ttsVoiceName: string;
  ttsFirstChunkTimeoutMs: number;
  ttsFirstChunkMaxChars: number;
  ttsChunkMaxChars: number;
  voiceSlowRttMs: number;
  voiceSlowDownlinkMbps: number;
  promptTemplateId: string;
  source: "remote" | "default";
}

const VALID_MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const VALID_VOICE_NAME = /^[A-Za-z][A-Za-z0-9_-]{1,31}$/;
const VALID_TEMPLATE_ID = /^[a-z0-9][a-z0-9_-]{1,63}$/i;
const MIN_OUTPUT_TOKENS = 128;
const MAX_OUTPUT_TOKENS = 2048;

export const DEFAULT_TTS_MODEL =
  process.env.NEXT_PUBLIC_FIREBASE_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
export const DEFAULT_TTS_VOICE =
  process.env.NEXT_PUBLIC_FIREBASE_TTS_VOICE?.trim() || "Kore";

function clampBoundedInt(raw: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function clampBoundedFloat(raw: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(min, Number(raw.toFixed(2))));
}

function readEnvInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  return clampBoundedInt(Number(raw), min, max, fallback);
}

function readEnvFloat(raw: string | undefined, min: number, max: number, fallback: number): number {
  return clampBoundedFloat(Number(raw), min, max, fallback);
}

function safeReadConfiguredCloudModel(): string {
  try {
    if (typeof firebaseClient.getConfiguredCloudModel === "function") {
      return firebaseClient.getConfiguredCloudModel();
    }
  } catch {
    // Handle partial module mocks in unit tests
  }
  return process.env.NEXT_PUBLIC_FIREBASE_AI_MODEL?.trim() || "gemini-3.5-flash-lite";
}

function safeReadFirebaseApp() {
  try {
    if (typeof firebaseClient.getFirebaseApp === "function") {
      return firebaseClient.getFirebaseApp();
    }
  } catch {
    // Handle partial module mocks in unit tests
  }
  return null;
}

function buildDefaultSnapshot(): AdvisorRemoteConfigSnapshot {
  const configuredCloudModel = safeReadConfiguredCloudModel();
  return {
    enabled: true,
    cloudModel: configuredCloudModel,
    maxOutputTokens: readEnvInt(
      process.env.NEXT_PUBLIC_FIREBASE_MAX_OUTPUT_TOKENS,
      MIN_OUTPUT_TOKENS,
      MAX_OUTPUT_TOKENS,
      512,
    ),
    preferOnDevice: true,
    ttsEnabled: true,
    ttsModel: sanitizeModelName(
      process.env.NEXT_PUBLIC_FIREBASE_TTS_MODEL ?? "",
      DEFAULT_TTS_MODEL,
    ),
    ttsVoiceName: sanitizeVoiceName(
      process.env.NEXT_PUBLIC_FIREBASE_TTS_VOICE ?? "",
      DEFAULT_TTS_VOICE,
    ),
    ttsFirstChunkTimeoutMs: readEnvInt(
      process.env.NEXT_PUBLIC_VOICE_FIRST_CHUNK_TIMEOUT_MS,
      1_500,
      15_000,
      4_500,
    ),
    ttsFirstChunkMaxChars: readEnvInt(
      process.env.NEXT_PUBLIC_VOICE_FIRST_CHUNK_MAX_CHARS,
      40,
      220,
      90,
    ),
    ttsChunkMaxChars: readEnvInt(
      process.env.NEXT_PUBLIC_VOICE_CHUNK_MAX_CHARS,
      80,
      400,
      165,
    ),
    voiceSlowRttMs: readEnvInt(
      process.env.NEXT_PUBLIC_VOICE_SLOW_RTT_MS,
      200,
      5_000,
      800,
    ),
    voiceSlowDownlinkMbps: readEnvFloat(
      process.env.NEXT_PUBLIC_VOICE_SLOW_DOWNLINK_MBPS,
      0.05,
      5,
      0.4,
    ),
    promptTemplateId: "",
    source: "default",
  };
}

let cachedRemoteConfig: RemoteConfig | null = null;
let activeSnapshot: AdvisorRemoteConfigSnapshot | null = null;
let inflightSync: Promise<AdvisorRemoteConfigSnapshot> | null = null;

function sanitizeModelName(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  return VALID_MODEL_NAME.test(trimmed) ? trimmed : fallback;
}

function sanitizeVoiceName(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  return VALID_VOICE_NAME.test(trimmed) ? trimmed : fallback;
}

function sanitizeTemplateId(raw: string): string {
  const trimmed = raw.trim();
  return VALID_TEMPLATE_ID.test(trimmed) ? trimmed : "";
}

/** Returns the latest active Remote Config snapshot synchronously, falling
    back to safe in-app defaults before the first fetch completes or when
    offline. */
export function getAdvisorRemoteConfig(): AdvisorRemoteConfigSnapshot {
  return activeSnapshot ?? buildDefaultSnapshot();
}

/** Fetches and activates Firebase Remote Config parameters for the Hybrid
    Weather Advisor. Never throws; safely retains defaults when offline,
    unsupported, or not yet published in Firebase Console. */
export async function syncAdvisorRemoteConfig(): Promise<AdvisorRemoteConfigSnapshot> {
  if (typeof window === "undefined") {
    return buildDefaultSnapshot();
  }
  if (inflightSync) {
    return inflightSync;
  }

  inflightSync = (async () => {
    const defaults = buildDefaultSnapshot();
    const host = window.location?.hostname ?? "";
    const isUnregisteredLocalhost =
      !process.env.VITEST &&
      (host === "localhost" || host === "127.0.0.1") &&
      !process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (isUnregisteredLocalhost) {
      activeSnapshot = defaults;
      return defaults;
    }
    const app = safeReadFirebaseApp();
    if (!app) {
      activeSnapshot = defaults;
      return defaults;
    }

    try {
      const supported = await isSupported();
      if (!supported) {
        activeSnapshot = defaults;
        return defaults;
      }

      const rc = cachedRemoteConfig ?? getRemoteConfig(app);
      cachedRemoteConfig = rc;

      rc.settings.minimumFetchIntervalMillis =
        process.env.NODE_ENV === "development" ? 60_000 : 3_600_000;
      rc.settings.fetchTimeoutMillis = 8_000;
      rc.defaultConfig = {
        advisor_enabled: defaults.enabled,
        advisor_cloud_model: defaults.cloudModel,
        advisor_max_output_tokens: defaults.maxOutputTokens,
        advisor_prefer_on_device: defaults.preferOnDevice,
        advisor_tts_enabled: defaults.ttsEnabled,
        advisor_tts_model: defaults.ttsModel,
        advisor_tts_voice: defaults.ttsVoiceName,
        advisor_tts_first_chunk_timeout_ms: defaults.ttsFirstChunkTimeoutMs,
        advisor_tts_first_chunk_max_chars: defaults.ttsFirstChunkMaxChars,
        advisor_tts_chunk_max_chars: defaults.ttsChunkMaxChars,
        advisor_voice_slow_rtt_ms: defaults.voiceSlowRttMs,
        advisor_voice_slow_downlink_mbps: defaults.voiceSlowDownlinkMbps,
        advisor_prompt_template_id: defaults.promptTemplateId,
      };

      await fetchAndActivate(rc);

      const snapshot: AdvisorRemoteConfigSnapshot = {
        enabled: getBoolean(rc, "advisor_enabled"),
        cloudModel: sanitizeModelName(
          getString(rc, "advisor_cloud_model"),
          defaults.cloudModel,
        ),
        maxOutputTokens: clampBoundedInt(
          getNumber(rc, "advisor_max_output_tokens"),
          MIN_OUTPUT_TOKENS,
          MAX_OUTPUT_TOKENS,
          defaults.maxOutputTokens,
        ),
        preferOnDevice: getBoolean(rc, "advisor_prefer_on_device"),
        ttsEnabled: getBoolean(rc, "advisor_tts_enabled"),
        ttsModel: sanitizeModelName(
          getString(rc, "advisor_tts_model"),
          defaults.ttsModel,
        ),
        ttsVoiceName: sanitizeVoiceName(
          getString(rc, "advisor_tts_voice"),
          defaults.ttsVoiceName,
        ),
        ttsFirstChunkTimeoutMs: clampBoundedInt(
          getNumber(rc, "advisor_tts_first_chunk_timeout_ms"),
          1_500,
          15_000,
          defaults.ttsFirstChunkTimeoutMs,
        ),
        ttsFirstChunkMaxChars: clampBoundedInt(
          getNumber(rc, "advisor_tts_first_chunk_max_chars"),
          40,
          220,
          defaults.ttsFirstChunkMaxChars,
        ),
        ttsChunkMaxChars: clampBoundedInt(
          getNumber(rc, "advisor_tts_chunk_max_chars"),
          80,
          400,
          defaults.ttsChunkMaxChars,
        ),
        voiceSlowRttMs: clampBoundedInt(
          getNumber(rc, "advisor_voice_slow_rtt_ms"),
          200,
          5_000,
          defaults.voiceSlowRttMs,
        ),
        voiceSlowDownlinkMbps: clampBoundedFloat(
          getNumber(rc, "advisor_voice_slow_downlink_mbps"),
          0.05,
          5,
          defaults.voiceSlowDownlinkMbps,
        ),
        promptTemplateId: sanitizeTemplateId(
          getString(rc, "advisor_prompt_template_id"),
        ),
        source: "remote",
      };

      activeSnapshot = snapshot;
      return snapshot;
    } catch {
      // Expected when offline or before a Remote Config template is published.
      activeSnapshot = defaults;
      return defaults;
    } finally {
      inflightSync = null;
    }
  })();

  return inflightSync;
}

export function resetAdvisorRemoteConfigForTests(): void {
  cachedRemoteConfig = null;
  activeSnapshot = null;
  inflightSync = null;
}
