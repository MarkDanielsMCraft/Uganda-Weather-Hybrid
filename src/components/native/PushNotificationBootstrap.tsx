"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native/platform";
import { safeAlertRoute } from "@/lib/native/deep-links";

export function PushNotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function setup() {
      if (!(await isNativeApp()) || cancelled) return;

      const { PushNotifications } = await import("@capacitor/push-notifications");

      const isLg = usePreferencesStore.getState().uiLanguage === "lg";
      try {
        await PushNotifications.createChannel({
          id: "weather_alerts",
          name: isLg ? "Okulabula ku budde bw'akabi" : "Severe Weather Alerts",
          description: isLg
            ? "Okulabula okw'amangu ku mbuyaga n'obudde bw'akabi mu disitulikiti yo"
            : "Urgent storm warnings and weather alerts for your district",
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: "#E8A838",
        });
      } catch (channelError) {
        console.warn("Could not register weather_alerts notification channel:", channelError);
      }

      listeners.push(
        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.info("Push received:", notification.title ?? notification.id);
        }),
      );

      listeners.push(
        await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          router.push(safeAlertRoute(event.notification.data?.route ?? "/alerts"));
        }),
      );
    }

    void setup();

    return () => {
      cancelled = true;
      for (const listener of listeners) {
        void listener.remove();
      }
    };
  }, [router]);

  return null;
}
