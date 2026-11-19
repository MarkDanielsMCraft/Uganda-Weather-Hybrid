"use client";

import { useEffect, useState } from "react";
import { prefersLightweightScene } from "@/lib/device/scene-capability";
import { usePreferencesStore } from "@/stores/preferencesStore";

/**
 * The effective lite-mode setting: an explicit choice from the settings
 * toggle if one has been made, otherwise what the device can afford.
 *
 * Detection runs in an effect rather than during render so the server and the
 * first client render agree. It starts lite and upgrades, which means the
 * animation never runs during the window where the page is still doing
 * hydration work, and a device that turns out to be constrained never starts
 * the loop at all.
 */
export function useLiteScene(): boolean {
  const preference = usePreferencesStore((state) => state.liteModePreference);
  const [deviceWantsLite, setDeviceWantsLite] = useState(false);

  useEffect(() => {
    const recheck = () => setDeviceWantsLite(prefersLightweightScene());
    recheck();

    // Both inputs can change while the page is open: the reader turns on
    // reduced motion in the OS, or the phone drops into data saver.
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    query?.addEventListener("change", recheck);

    const connection = (
      navigator as Navigator & {
        connection?: {
          addEventListener?: (type: string, listener: () => void) => void;
          removeEventListener?: (type: string, listener: () => void) => void;
        };
      }
    ).connection;
    connection?.addEventListener?.("change", recheck);

    return () => {
      query?.removeEventListener("change", recheck);
      connection?.removeEventListener?.("change", recheck);
    };
  }, []);

  return preference ?? deviceWantsLite;
}
