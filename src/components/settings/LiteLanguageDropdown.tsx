"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";

const LITE_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "lg", label: "Luganda" },
] as const;

export function LiteLanguageDropdown({
  districtSlug,
  lang,
}: {
  districtSlug: string;
  lang: "en" | "lg";
}) {
  const router = useRouter();
  const setUiLanguage = usePreferencesStore((state) => state.setUiLanguage);
  const isLg = lang === "lg";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
    setUiLanguage(lang);
  }, [districtSlug, lang, setUiLanguage]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelectLanguage = (nextLang: "en" | "lg") => {
    setOpen(false);
    setUiLanguage(nextLang);
    if (nextLang !== lang) {
      router.push(
        `/lite?district=${encodeURIComponent(districtSlug)}&lang=${nextLang}`,
      );
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isLg ? "Olulimi" : "Language"}
        data-testid="lite-language-dropdown"
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 text-white/90 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.96]"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-4 w-4 shrink-0"
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
          className={`h-2.5 w-2.5 text-white/70 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={isLg ? "Olulimi" : "Language"}
          className="absolute right-0 z-50 mt-2 min-w-[164px] max-w-[calc(100vw-1.5rem)] space-y-0.5 rounded-[18px] border border-white/[0.14] bg-[rgba(14,20,34,0.97)] p-[6px] shadow-[0_18px_40px_-6px_rgba(0,0,0,0.75),0_4px_12px_-2px_rgba(0,0,0,0.45)] backdrop-blur-[32px] backdrop-saturate-[200%]"
        >
          {LITE_LANGUAGE_OPTIONS.map((opt) => {
            const active = opt.code === lang;
            return (
              <button
                key={opt.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => handleSelectLanguage(opt.code)}
                className={`my-[2px] flex min-h-[42px] w-full items-center justify-between gap-3 rounded-full px-[14px] py-[7px] text-left text-[14px] font-medium transition-colors ${
                  active
                    ? "bg-brand-green/65 text-on-brand shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)]"
                    : "text-[#f8fafc] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{opt.label}</span>
                {active && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
