"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sharePathForWeather } from "@/lib/places/share";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";

export function SharePlaceLink({
  weather,
  sharePath,
  shareLabel,
  className = "text-on-sky text-[14px] font-medium text-white/90 underline-offset-2 hover:text-white hover:underline",
}: {
  weather: WeatherBundle;
  sharePath?: string;
  shareLabel?: string;
  className?: string;
}) {
  const { dict } = useTranslation();
  const { activePlace } = useAppLocation();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const label = shareLabel ?? dict.common.copyPlaceLink;
  const shareHref = useMemo(() => {
    const path = sharePath ?? sharePathForWeather(weather, activePlace);
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [weather, activePlace, sharePath]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(shareHref)
          .then(() => {
            setCopied(true);
            if (timeoutRef.current != null) {
              window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      className={className}
    >
      {copied ? dict.common.linkCopied : label}
    </button>
  );
}
