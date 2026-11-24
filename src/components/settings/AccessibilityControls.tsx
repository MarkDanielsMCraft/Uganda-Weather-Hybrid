"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferencesStore";

interface AccessibilityControlsProps {
  compact?: boolean;
  language?: "en" | "lg";
  bare?: boolean;
}

export function AccessibilityControls({
  compact = false,
  language,
  bare = false,
}: AccessibilityControlsProps) {
  const { uiLanguage } = useTranslation();
  const effectiveLang = language ?? uiLanguage;
  const isLg = effectiveLang === "lg";
  const [mounted, setMounted] = useState(false);
  const largeText = usePreferencesStore((state) => state.largeText);
  const highContrast = usePreferencesStore((state) => state.highContrast);
  const setLargeText = usePreferencesStore((state) => state.setLargeText);
  const setHighContrast = usePreferencesStore((state) => state.setHighContrast);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLargeText = mounted ? largeText : false;
  const isHighContrast = mounted ? highContrast : false;

  const largeTextLabel = isLg ? "Ennukuta ennene" : "Large text";
  const contrastLabel = isLg ? "Okulabika obulungi" : "High contrast";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={isLargeText}
          aria-label={largeTextLabel}
          onClick={() => setLargeText(!isLargeText)}
          className={`inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            isLargeText
              ? "border-white/35 bg-brand-green/80 text-on-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              : "border-white/15 bg-white/8 text-white/80 hover:border-white/25 hover:text-white"
          }`}
        >
          {isLg ? "A+ Ennene" : "A+ Large"}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={isHighContrast}
          aria-label={contrastLabel}
          onClick={() => setHighContrast(!isHighContrast)}
          className={`inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            isHighContrast
              ? "border-white/35 bg-brand-green/80 text-on-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              : "border-white/15 bg-white/8 text-white/80 hover:border-white/25 hover:text-white"
          }`}
        >
          {isLg ? "Okulabika" : "Contrast"}
        </button>
      </div>
    );
  }

  return (
    <div className={bare ? "space-y-3" : "space-y-3 border-t border-white/10 pt-3"}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="a11y-large-text-switch"
          className="min-w-0 cursor-pointer break-words text-[12.5px] font-semibold leading-tight text-white/75"
        >
          {largeTextLabel}
        </label>
        <button
          id="a11y-large-text-switch"
          type="button"
          role="switch"
          aria-label={largeTextLabel}
          aria-checked={isLargeText}
          onClick={() => setLargeText(!isLargeText)}
          className={`relative h-6 w-10 shrink-0 rounded-full border transition backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            isLargeText
              ? "border-white/40 bg-brand-green/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              : "border-white/15 bg-white/10 hover:border-white/25"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition ${
              isLargeText ? "left-[19px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="a11y-contrast-switch"
          className="min-w-0 cursor-pointer break-words text-[12.5px] font-semibold leading-tight text-white/75"
        >
          {contrastLabel}
        </label>
        <button
          id="a11y-contrast-switch"
          type="button"
          role="switch"
          aria-label={contrastLabel}
          aria-checked={isHighContrast}
          onClick={() => setHighContrast(!isHighContrast)}
          className={`relative h-6 w-10 shrink-0 rounded-full border transition backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            isHighContrast
              ? "border-white/40 bg-brand-green/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              : "border-white/15 bg-white/10 hover:border-white/25"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition ${
              isHighContrast ? "left-[19px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
