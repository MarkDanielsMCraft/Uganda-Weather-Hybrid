"use client";

import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "@/components/glass/GlassCard";
import { getCurrentCoordinates } from "@/lib/native/geolocation";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import type { PlaceLocation } from "@/lib/places/types";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { useTranslation } from "@/lib/i18n";

export function UseMyLocationButton({
  className = "",
  popover = false,
}: {
  className?: string;
  popover?: boolean;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const { selectPlace } = useDistrictNavigation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!message || !popover) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMessage(null);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMessage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [message, popover]);

  const handleClick = async () => {
    if (busy) return;
    setMessage(null);
    setBusy(true);

    try {
      const coords = await getCurrentCoordinates();
      if (!coords) {
        setMessage(dict.search.locationOff);
        return;
      }

      if (!isWithinUganda(coords.lat, coords.lon)) {
        setMessage(dict.search.locationOutsideUganda);
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
    } catch {
      setMessage(dict.search.locationResolveError);
    } finally {
      setBusy(false);
    }
  };

  const buttonText = busy
    ? isLuganda
      ? "Nnoonya we ndi kati"
      : "Finding your location"
    : isLuganda
    ? "Kozesa we ndi kati"
    : "Use my location";

  return (
    <div ref={containerRef} className={className}>
      <button
        type="button"
        aria-label={buttonText}
        onClick={() => {
          void handleClick();
        }}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.08] px-4 py-3.5 text-[17px] font-medium text-white transition hover:bg-white/[0.12] disabled:opacity-60"
      >
        <span aria-hidden className="text-[18px]">
          ◉
        </span>
        <span>{buttonText}</span>
      </button>
      {message &&
        (popover ? (
          <GlassPanel className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] bg-[rgba(14,20,34,0.94)] p-3 text-center shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <div role="status">
              <p className="text-[13px] leading-snug text-white/90">{message}</p>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="mt-2 text-[11px] font-medium text-white/75 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {dict.common.dismiss}
              </button>
            </div>
          </GlassPanel>
        ) : (
          <p className="mt-2 text-center text-[14px] text-white/75">{message}</p>
        ))}
    </div>
  );
}
