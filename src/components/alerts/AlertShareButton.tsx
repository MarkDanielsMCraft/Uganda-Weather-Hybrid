"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { alertsPath } from "@/lib/native/deep-links";
import type { WeatherAlert } from "@/types/weather";

export function AlertShareButton({
  alert,
  districtSlug,
}: {
  alert: WeatherAlert;
  districtSlug: string;
}) {
  const { dict } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const path = alertsPath(districtSlug, alert.id);

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
        const href =
          typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
        void navigator.clipboard
          ?.writeText(href)
          .then(() => {
            setCopied(true);
            if (timeoutRef.current != null) {
              window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      className="text-[13px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
    >
      {copied ? dict.alerts.alertLinkCopied : dict.alerts.copyAlertLink}
    </button>
  );
}
