import { isNativeApp, nativePlatform } from "./platform";
import type { PluginListenerHandle } from "@capacitor/core";
import { usePreferencesStore } from "@/stores/preferencesStore";

const REGISTRATION_TIMEOUT_MS = 15_000;

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: "web" | "denied" | "registration_failed" | "network" };

async function postPushRegistration(
  token: string,
  districtSlug: string,
  language?: "en" | "lg",
) {
  const resolvedLanguage =
    language ?? usePreferencesStore.getState().uiLanguage ?? "en";
  const response = await fetch("/api/v1/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: await nativePlatform(),
      districtSlug,
      language: resolvedLanguage,
    }),
  });

  return response.ok;
}

export async function registerPushNotifications(districtSlug: string): Promise<PushRegistrationResult> {
  try {
    if (!(await isNativeApp())) {
      return { ok: false, reason: "web" };
    }

    const { PushNotifications } = await import("@capacitor/push-notifications");
    const permission = await PushNotifications.checkPermissions();

    if (permission.receive !== "granted") {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== "granted") {
        return { ok: false, reason: "denied" };
      }
    }

    return await new Promise<PushRegistrationResult>((resolve) => {
      let settled = false;
      const listeners: Promise<PluginListenerHandle>[] = [];

      const cleanup = async () => {
        clearTimeout(timeout);
        const results = await Promise.allSettled(
          listeners.map(async (listener) => (await listener).remove()),
        );
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Push notification listener cleanup failed:", result.reason);
          }
        }
      };

      const finish = (result: PushRegistrationResult) => {
        if (settled) return;
        settled = true;
        void cleanup().then(() => resolve(result));
      };

      const timeout = setTimeout(
        () => finish({ ok: false, reason: "registration_failed" }),
        REGISTRATION_TIMEOUT_MS,
      );

      const registrationListener = PushNotifications.addListener("registration", async (token) => {
        try {
          const ok = await postPushRegistration(token.value, districtSlug);
          finish(ok ? { ok: true, token: token.value } : { ok: false, reason: "network" });
        } catch {
          finish({ ok: false, reason: "network" });
        }
      });
      listeners.push(registrationListener);

      const errorListener = PushNotifications.addListener("registrationError", () => {
        finish({ ok: false, reason: "registration_failed" });
      });
      listeners.push(errorListener);

      void Promise.all([registrationListener, errorListener])
        .then(() => {
          if (!settled) return PushNotifications.register();
        })
        .catch(() => finish({ ok: false, reason: "registration_failed" }));
    });
  } catch (error) {
    console.error("Push notification registration failed:", error);
    return { ok: false, reason: "registration_failed" };
  }
}

export async function syncPushDistrict(
  token: string,
  districtSlug: string,
  language?: "en" | "lg",
) {
  if (!(await isNativeApp())) return false;
  return postPushRegistration(token, districtSlug, language);
}

export async function unregisterPushNotifications(token?: string | null): Promise<boolean> {
  if (!(await isNativeApp())) return true;

  if (token) {
    const response = await fetch("/api/v1/push/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      throw new Error(`Push token removal failed with status ${response.status}`);
    }
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
    return true;
  } catch (error) {
    console.error("Could not unregister native push notifications:", error);
    return false;
  }
}
