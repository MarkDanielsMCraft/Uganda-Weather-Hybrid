"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n/types";

const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: SupportedLocale;
  label: string;
}> = [
  { code: "en", label: "English" },
  { code: "lg", label: "Luganda" },
];

export function LanguageDropdown({
  testId = "language-dropdown-trigger",
  compact = false,
  align = "auto",
}: {
  testId?: string;
  compact?: boolean;
  align?: "left" | "right" | "auto";
}) {
  const { uiLanguage, setUiLanguage, dict } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const alignClass =
    align === "right"
      ? "right-0 left-auto"
      : align === "left"
        ? "left-0 right-auto"
        : "left-0 sm:right-0 sm:left-auto";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dict.settings.language}
        data-testid={testId}
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 text-white/90 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.96] ${
          compact ? "h-9 px-2.5" : "h-9 px-2.5"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={compact ? "h-4 w-4" : "h-4 w-4"}
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7.25" />
          <path d="M2.9 10h14.2M10 2.75c2.1 2.1 3.15 4.52 3.15 7.25S12.1 15.15 10 17.25M10 2.75C7.9 4.85 6.85 7.27 6.85 10S7.9 15.15 10 17.25" />
        </svg>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className={`h-2.5 w-2.5 text-white/70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={dict.settings.language}
          className={`absolute ${alignClass} z-50 mt-2 min-w-[164px] max-w-[calc(100vw-1.5rem)] space-y-0.5 rounded-[18px] border border-white/[0.14] bg-[rgba(14,20,34,0.97)] p-[6px] shadow-[0_18px_40px_-6px_rgba(0,0,0,0.72),0_4px_12px_-2px_rgba(0,0,0,0.45)] backdrop-blur-[32px] backdrop-saturate-[200%]`}
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = uiLanguage === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setUiLanguage(option.code);
                  setOpen(false);
                }}
                className={`my-[2px] flex min-h-[44px] w-full items-center justify-between gap-3 rounded-full px-[14px] py-[7px] text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  active
                    ? "bg-brand-green/65 text-on-brand shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                    : "text-[#f8fafc] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5 opacity-80"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="5.75" />
                    <path d="M2.4 8h11.2M8 2.25c1.6 1.6 2.4 3.5 2.4 5.75S9.6 12.15 8 13.75M8 2.25C6.4 3.85 5.6 5.75 5.6 8s.8 4.15 2.4 5.75" />
                  </svg>
                  <span>{option.label}</span>
                </span>
                {active && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
