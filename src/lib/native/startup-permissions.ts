import { isNativeApp } from "./platform";
import { registerPushNotifications } from "./push";
import { usePreferencesStore } from "@/stores/preferencesStore";

export interface NativePermissionStatus {
  location: "granted" | "denied" | "unsupported";
  notifications: "granted" | "denied" | "unsupported";
}

let permissionRequest: Promise<NativePermissionStatus> | null = null;

/**
 * Requests required runtime permissions (Location for district weather detection
 * and Push Notifications for severe weather alerts) on native mobile platforms.
 * Safe to call on every app launch: only prompts when permissions are not yet decided.
 * Concurrent startup effects share one request so development remounts cannot race prompts.
 */
export async function requestNativeAppPermissions(
  districtSlug: string,
): Promise<NativePermissionStatus> {
  if (permissionRequest) return permissionRequest;

  permissionRequest = requestNativeAppPermissionsOnce(districtSlug);
  try {
    return await permissionRequest;
  } finally {
    permissionRequest = null;
  }
}

async function requestNativeAppPermissionsOnce(
  districtSlug: string,
): Promise<NativePermissionStatus> {
  if (!(await isNativeApp())) {
    return { location: "unsupported", notifications: "unsupported" };
  }

  let locationState: NativePermissionStatus["location"] = "unsupported";
  let notificationState: NativePermissionStatus["notifications"] = "unsupported";

  // 1. Location permission for automatic district weather resolution
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const check = await Geolocation.checkPermissions();

    if (check.location === "prompt" || check.location === "prompt-with-rationale") {
      const requested = await Geolocation.requestPermissions();
      locationState = requested.location === "granted" ? "granted" : "denied";
    } else {
      locationState = check.location === "granted" ? "granted" : "denied";
    }

    if (locationState === "granted" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("uw:location-permission-granted"));
    }
  } catch (error) {
    console.error("Location permission request failed:", error);
    locationState = "denied";
  }

  // 2. Notification permission for severe storm and weather warnings
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const check = await PushNotifications.checkPermissions();

    if (check.receive === "prompt" || check.receive === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive === "granted") {
        notificationState = "granted";
        const result = await registerPushNotifications(districtSlug);
        if (result.ok) {
          usePreferencesStore.getState().setPushDeviceToken(result.token);
          usePreferencesStore.getState().setPushAlerts(true);
        } else {
          usePreferencesStore.getState().setPushDeviceToken(null);
          usePreferencesStore.getState().setPushAlerts(false);
          console.warn("Push alerts were not enabled:", result.reason);
        }
      } else {
        notificationState = "denied";
        usePreferencesStore.getState().setPushAlerts(false);
      }
    } else if (check.receive === "granted") {
      notificationState = "granted";
    } else {
      notificationState = "denied";
    }
  } catch (error) {
    console.error("Notification permission request failed:", error);
    notificationState = "denied";
  }

  return { location: locationState, notifications: notificationState };
}
