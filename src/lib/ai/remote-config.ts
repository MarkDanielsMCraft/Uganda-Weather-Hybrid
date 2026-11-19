import {
  fetchAndActivate,
  getBoolean,
  getNumber,
  getRemoteConfig,
  getString,
  isSupported,
  type RemoteConfig,
} from "firebase/remote-config";
import { getConfiguredCloudModel, getFirebaseApp } from "@/lib/ai/firebase-client";

export interface AdvisorRemoteConfigSnapshot {
  enabled: boolean;
  cloudModel: string;
  maxOutputTokens: number;
  preferOnDevice: boolean;
  source: "remote" | "default";
}

const VALID_MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const MIN_OUTPUT_TOKENS = 128;
const MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_MAX_OUTPUT_TOKENS = 512;

function buildDefaultSnapshot(): AdvisorRemoteConfigSnapshot {
  return {
    enabled: true,
    cloudModel: getConfiguredCloudModel(),
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    preferOnDevice: true,
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

function sanitizeMaxTokens(raw: number, fallback: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.round(raw)));
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
    const app = getFirebaseApp();
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
      };

      await fetchAndActivate(rc);

      const snapshot: AdvisorRemoteConfigSnapshot = {
        enabled: getBoolean(rc, "advisor_enabled"),
        cloudModel: sanitizeModelName(
          getString(rc, "advisor_cloud_model"),
          defaults.cloudModel,
        ),
        maxOutputTokens: sanitizeMaxTokens(
          getNumber(rc, "advisor_max_output_tokens"),
          defaults.maxOutputTokens,
        ),
        preferOnDevice: getBoolean(rc, "advisor_prefer_on_device"),
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
