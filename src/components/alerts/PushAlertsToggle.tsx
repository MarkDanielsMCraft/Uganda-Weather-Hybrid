"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/platform";
import { registerPushNotifications, unregisterPushNotifications } from "@/lib/native/push";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/lib/i18n";

export function PushAlertsToggle() {
  const { dict } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pushAlerts = usePreferencesStore((state) => state.pushAlerts);
  const pushDeviceToken = usePreferencesStore((state) => state.pushDeviceToken);
  const setPushAlerts = usePreferencesStore((state) => state.setPushAlerts);
  const setPushDeviceToken = usePreferencesStore((state) => state.setPushDeviceToken);
  const districtSlug = usePreferencesStore((state) => state.districtSlug);

  useEffect(() => {
    void isNativeApp().then(setNative);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleToggle = async () => {
    if (busy) return;
    setMessage(null);
    setBusy(true);

    try {
      if (pushAlerts) {
        const deviceUnregistered = await unregisterPushNotifications(pushDeviceToken);
        setPushDeviceToken(null);
        setPushAlerts(false);
        setMessage(
          deviceUnregistered
            ? dict.alerts.pushTurnedOff
            : dict.alerts.pushTurnedOffPartial,
        );
        return;
      }

      if (!native) {
        setMessage(dict.alerts.pushAvailableMobile);
        return;
      }

      const result = await registerPushNotifications(districtSlug);
      if (result.ok) {
        setPushDeviceToken(result.token);
        setPushAlerts(true);
        setMessage(dict.alerts.pushEnabled);
        return;
      }

      if (result.reason === "denied") {
        setMessage(dict.alerts.pushDenied);
        return;
      }

      setMessage(dict.alerts.pushEnableError);
    } catch (error) {
      console.error("Could not update storm alert settings:", error);
      setMessage(
        pushAlerts
          ? dict.alerts.pushDisableError
          : dict.alerts.pushEnableError,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-white">{dict.alerts.pushTitle}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/50">
            {native
              ? dict.alerts.pushSubtitleNative
              : dict.alerts.pushSubtitleWeb}
          </p>
          {message && <p className="mt-2 text-[12px] leading-snug text-white/70">{message}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-label={dict.alerts.pushAriaLabel}
          aria-checked={pushAlerts}
          aria-busy={busy}
          disabled={busy || !native}
          onClick={() => {
            void handleToggle();
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition backdrop-blur-md ${
            pushAlerts
              ? "border-white/40 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              : "border-white/15 bg-white/10"
          } ${!native || busy ? "opacity-50" : ""}`}
        >
          <span
            className={`absolute top-[1px] h-6 w-6 rounded-full bg-white shadow transition ${
              pushAlerts ? "left-[21px]" : "left-[1px]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
