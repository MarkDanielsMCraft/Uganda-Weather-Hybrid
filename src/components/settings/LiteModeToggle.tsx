"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/lib/i18n";

export function LiteModeToggle() {
  const router = useRouter();
  const { dict, uiLanguage } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const setLiteModePreference = usePreferencesStore((s) => s.setLiteModePreference);

  const liteHref = `/lite?district=${encodeURIComponent(districtSlug || "kampala")}&lang=${uiLanguage}`;

  useEffect(() => {
    setMounted(true);
    setSwitching(false);
  }, [districtSlug, uiLanguage]);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    router.prefetch?.(liteHref);
  }, [mounted, router, liteHref]);

  if (!mounted) return null;

  const handleToggle = () => {
    setSwitching(true);
    setLiteModePreference(true);
    router.push(liteHref);
    if (typeof window !== "undefined") {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        if (!window.location.pathname.startsWith("/lite")) {
          window.location.assign(liteHref);
        }
      }, 350);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="lite-mode-switch"
          className="cursor-pointer truncate text-[12.5px] font-semibold leading-tight text-white/75"
        >
          {dict.settings.liteMode}
        </label>
        <button
          id="lite-mode-switch"
          type="button"
          role="switch"
          aria-label={dict.settings.liteMode}
          aria-checked={switching}
          onClick={handleToggle}
          className={`relative h-6 w-10 shrink-0 rounded-full border transition backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            switching
              ? "border-white/40 bg-brand-green/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              : "border-white/15 bg-white/10 hover:border-white/25"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition ${
              switching ? "left-[19px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>
      <p className="line-clamp-2 h-[32px] text-[11.5px] leading-[16px] text-white/70">
        {dict.settings.liteModeDesc}
      </p>
    </div>
  );
}
