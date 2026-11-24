import crypto from "node:crypto";
import { listPushTokensForDistrict, removePushToken } from "@/lib/push/store";
import { mapInBatches, PUSH_SEND_BATCH_SIZE } from "@/lib/push/batches";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { sendApnsNotifications } from "./apns";

const FCM_TIMEOUT_MS = 5_000;

export interface StormAlertPayload {
  districtSlug: string;
  title: string;
  body: string;
  route?: string;
  localized?: {
    lg?: {
      title: string;
      body: string;
    };
  };
}

export interface DispatchResult {
  districtSlug: string;
  targeted: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  provider: "fcm" | "apns" | "mixed" | "log";
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedAccessToken: CachedToken | null = null;
let inFlightTokenPromise: Promise<string | null> | null = null;

export function resetCachedFcmToken(): void {
  cachedAccessToken = null;
  inFlightTokenPromise = null;
}

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

export async function getFcmAccessToken(): Promise<string | null> {
  if (process.env.FIREBASE_ACCESS_TOKEN) {
    return process.env.FIREBASE_ACCESS_TOKEN;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token;
  }

  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  inFlightTokenPromise = (async () => {
    try {
      const header = { alg: "RS256", typ: "JWT" };
      const claimSet = {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(claimSet));
      const unsignedToken = `${encodedHeader}.${encodedPayload}`;

      const signer = crypto.createSign("RSA-SHA256");
      signer.update(unsignedToken);
      signer.end();
      const signature = signer.sign(privateKey);
      const assertion = `${unsignedToken}.${base64UrlEncode(signature)}`;

      const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      });

      const response = await fetchWithTimeout(
        (signal) =>
          fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
            signal,
          }),
        FCM_TIMEOUT_MS,
      );

      if (!response.ok) {
        console.warn(`[push:fcm] OAuth2 token exchange failed with status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) {
        return null;
      }

      cachedAccessToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in ?? 3600),
      };

      return data.access_token;
    } catch (error) {
      console.warn("[push:fcm] Failed to mint OAuth2 token:", error);
      return null;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

async function sendFcmNotification(
  tokens: string[],
  payload: StormAlertPayload,
): Promise<{ sent: number; failed: number; goneTokens?: string[] }> {
  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const accessToken = await getFcmAccessToken();
  const serverKey = process.env.FIREBASE_SERVER_KEY;

  // 1. Modern FCM HTTP v1 API
  if (projectId && accessToken) {
    let sent = 0;
    let failed = 0;
    const goneTokens: string[] = [];
    await mapInBatches(
      tokens,
      PUSH_SEND_BATCH_SIZE,
      async (token) => {
        try {
          const response = await fetchWithTimeout(
            (signal) =>
              fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: {
                    token,
                    notification: {
                      title: payload.title,
                      body: payload.body,
                    },
                    data: {
                      district: payload.districtSlug,
                      route: payload.route ?? "/alerts",
                    },
                    android: {
                      priority: "high",
                      notification: {
                        channel_id: "weather_alerts",
                        icon: "ic_stat_weather_alert",
                        color: "#E8A838",
                      },
                    },
                  },
                }),
                signal,
              }),
            FCM_TIMEOUT_MS,
          );
          if (response.ok) {
            sent += 1;
          } else {
            failed += 1;
            // The FCM HTTP v1 API answers 404 when the app was removed or the
            // token expired, so that token will never work again.
            if (response.status === 404) goneTokens.push(token);
          }
        } catch {
          failed += 1;
        }
      },
    );
    return { sent, failed, goneTokens };
  }

  // 2. Legacy server key fallback with deprecation guard
  if (!serverKey) {
    return { sent: 0, failed: tokens.length };
  }

  const response = await fetchWithTimeout(
    (signal) =>
      fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_ids: tokens,
          priority: "high",
          notification: {
            title: payload.title,
            body: payload.body,
            android_channel_id: "weather_alerts",
            icon: "ic_stat_weather_alert",
            color: "#E8A838",
          },
          data: {
            district: payload.districtSlug,
            route: payload.route ?? "/alerts",
          },
        }),
        signal,
      }),
    FCM_TIMEOUT_MS,
  );

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      console.warn(
        "[push:fcm] Legacy FCM endpoint disabled upstream. Configure FIREBASE_PROJECT_ID and FIREBASE_ACCESS_TOKEN for HTTP v1.",
      );
    }
    throw new Error(`FCM dispatch failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    success?: number;
    failure?: number;
  };

  return {
    sent: result.success ?? 0,
    failed: result.failure ?? Math.max(tokens.length - (result.success ?? 0), 0),
  };
}

async function forgetGoneTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const outcomes = await Promise.allSettled(tokens.map((token) => removePushToken(token)));
  const failures = outcomes.filter((outcome) => outcome.status === "rejected").length;
  console.info(`[push] removed tokens for phones that no longer exist count=${tokens.length - failures}`);
  if (failures > 0) {
    console.warn(`[push] action blocked action=remove_gone_tokens code=REMOVE_FAILED count=${failures}`);
  }
}

export async function dispatchStormAlert(
  payload: StormAlertPayload,
  options?: { dryRun?: boolean },
): Promise<DispatchResult> {
  const entries = await listPushTokensForDistrict(payload.districtSlug);
  const androidTokens = entries
    .filter((entry) => entry.record.platform === "android")
    .map((entry) => entry.token);
  const iosTokens = entries
    .filter((entry) => entry.record.platform === "ios")
    .map((entry) => entry.token);
  const fcmConfigured = Boolean(
    process.env.FIREBASE_SERVER_KEY ||
      (process.env.FIREBASE_PROJECT_ID &&
        (process.env.FIREBASE_ACCESS_TOKEN ||
          (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY))),
  );
  const apnsConfigured = Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_PRIVATE_KEY &&
      process.env.APNS_TOPIC,
  );
  const dryRun =
    options?.dryRun ?? (!fcmConfigured && !apnsConfigured);

  const provider =
    androidTokens.length > 0 && iosTokens.length > 0
      ? "mixed"
      : iosTokens.length > 0
        ? "apns"
        : androidTokens.length > 0
          ? "fcm"
          : fcmConfigured && apnsConfigured
            ? "mixed"
            : apnsConfigured
              ? "apns"
              : "fcm";

  if (entries.length === 0) {
    return {
      districtSlug: payload.districtSlug,
      targeted: 0,
      sent: 0,
      failed: 0,
      dryRun,
      provider: dryRun ? "log" : provider,
    };
  }

  if (dryRun) {
    console.info(
      `[push:dry-run] ${payload.districtSlug}: "${payload.title}" to ${entries.length} device(s)`,
    );
    return {
      districtSlug: payload.districtSlug,
      targeted: entries.length,
      sent: entries.length,
      failed: 0,
      dryRun: true,
      provider: "log",
    };
  }

  const enEntries = entries.filter((entry) => entry.record.language !== "lg");
  const lgEntries = entries.filter((entry) => entry.record.language === "lg");

  const enPayload: StormAlertPayload = payload;
  const lgPayload: StormAlertPayload = payload.localized?.lg
    ? {
        ...payload,
        title: payload.localized.lg.title,
        body: payload.localized.lg.body,
      }
    : payload;

  const dispatchGroup = async (
    groupEntries: typeof entries,
    groupPayload: StormAlertPayload,
  ) => {
    const groupAndroidTokens = groupEntries
      .filter((entry) => entry.record.platform === "android")
      .map((entry) => entry.token);
    const groupIosTokens = groupEntries
      .filter((entry) => entry.record.platform === "ios")
      .map((entry) => entry.token);

    const [fcmResult, apnsResult] = await Promise.all([
      sendFcmNotification(groupAndroidTokens, groupPayload).catch((error: unknown) => {
        console.error(`[push:fcm] dispatch failed for ${payload.districtSlug}:`, error);
        return { sent: 0, failed: groupAndroidTokens.length };
      }),
      groupIosTokens.length
        ? sendApnsNotifications(groupIosTokens, groupPayload).catch((error: unknown) => {
            console.error(`[push:apns] dispatch failed for ${payload.districtSlug}:`, error);
            return { sent: 0, failed: groupIosTokens.length };
          })
        : Promise.resolve({ sent: 0, failed: 0 }),
    ]);

    const goneTokens = [
      ...("goneTokens" in fcmResult ? (fcmResult.goneTokens ?? []) : []),
      ...("goneTokens" in apnsResult ? (apnsResult.goneTokens ?? []) : []),
    ];
    await forgetGoneTokens(goneTokens);

    return {
      sent: fcmResult.sent + apnsResult.sent,
      failed: fcmResult.failed + apnsResult.failed,
    };
  };

  const [enResult, lgResult] = await Promise.all([
    enEntries.length > 0 ? dispatchGroup(enEntries, enPayload) : Promise.resolve({ sent: 0, failed: 0 }),
    lgEntries.length > 0 ? dispatchGroup(lgEntries, lgPayload) : Promise.resolve({ sent: 0, failed: 0 }),
  ]);

  const sent = enResult.sent + lgResult.sent;
  const failed = enResult.failed + lgResult.failed;

  return {
    districtSlug: payload.districtSlug,
    targeted: entries.length,
    sent,
    failed,
    dryRun: false,
    provider,
  };
}
