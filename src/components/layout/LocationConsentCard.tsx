"use client";

import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "@/components/glass/GlassCard";
import { getCurrentCoordinates } from "@/lib/native/geolocation";
import { isNativeApp } from "@/lib/native/platform";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { useTranslation } from "@/lib/i18n";
import type { PlaceLocation } from "@/lib/places/types";

const COOKIE_KEY = "uw:cookie-consent";
// Session-scoped, not permanent: dismissing hides the card for this visit
// but it can offer again on a later visit, since people move around and
// may want their location then even if they skipped it earlier.
const DISMISS_KEY = "uw:location-consent-dismissed";
// How long a final message stays on screen before the card dismisses itself.
const MESSAGE_VISIBLE_MS = 5000;

/** True only when the browser would still show its native permission
    prompt. "granted" is already followed continuously by
    GeolocationBootstrap; "denied" is the visitor's choice to respect. Never
    triggers the prompt itself — permissions.query only reads state. */
async function browserWillPrompt(): Promise<boolean> {
  if (await isNativeApp()) return false;
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "prompt";
  } catch {
    return false;
  }
}

export function LocationConsentCard() {
  const { dict } = useTranslation();
  const hasHydrated = usePreferencesStore((state) => state._hasHydrated);
  const { selectPlace } = useDistrictNavigation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    let cancelled = false;
    void (async () => {
      // Sequence after the cookie banner so the two glass cards never stack.
      try {
        if (!localStorage.getItem(COOKIE_KEY)) return;
        if (sessionStorage.getItem(DISMISS_KEY)) return;
      } catch {
        return;
      }
      if ((await browserWillPrompt()) && !cancelled) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasHydrated]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  if (!visible) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setVisible(false);
  }

  /** Show the outcome, then take the card away on its own. Every one of these
      cases is terminal: the permission prompt has already been answered, so
      the card's button can no longer do anything and leaving it on screen
      reads as a banner stuck there for the rest of the session. */
  function reportAndDismiss(text: string) {
    setMessage(text);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setVisible(false), MESSAGE_VISIBLE_MS);
  }

  async function allow() {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const coords = await getCurrentCoordinates();
      if (!coords) {
        reportAndDismiss(dict.search.locationDeclined);
        return;
      }

      if (!isWithinUganda(coords.lat, coords.lon)) {
        reportAndDismiss(dict.search.locationOutsideUganda);
        return;
      }

      const response = await fetch(
        `/api/v1/locations/reverse?lat=${coords.lat}&lon=${coords.lon}`,
      );
      let place: PlaceLocation | null = null;

      if (response.ok) {
        const payload = await response.json();
        place = payload.data?.place ?? null;
      }

      if (!place) {
        const { createGpsPlaceLocation } = await import("@/lib/places/district-from-place");
        place = createGpsPlaceLocation(coords.lat, coords.lon);
      }

      selectPlace(place);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("uw:location-permission-granted"));
      }
      try {
        sessionStorage.setItem(DISMISS_KEY, "1");
      } catch {}
      setVisible(false);
    } catch {
      reportAndDismiss(dict.consent.locationError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-50 mx-auto max-w-lg px-4 py-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <span aria-hidden className="text-[18px] text-white/85">
          ◉
        </span>
        {dict.consent.locationTitle}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/82">
        {dict.consent.locationBody}
      </p>
      {message && <p className="mt-2 text-[13px] text-white/60">{message}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[15px] font-medium text-white/85 backdrop-blur-md transition hover:bg-white/10 disabled:opacity-60"
        >
          {dict.consent.notNow}
        </button>
        <button
          type="button"
          onClick={() => {
            void allow();
          }}
          disabled={busy}
          className="flex-1 rounded-full border border-white/30 bg-white/[0.18] px-4 py-2.5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md transition hover:bg-white/[0.26] disabled:opacity-60"
        >
          {busy ? dict.consent.findingLocation : dict.consent.allowLocation}
        </button>
      </div>
    </GlassPanel>
  );
}
