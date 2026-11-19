"use client";

import { useEffect, useState } from "react";
import { useLiteScene } from "@/hooks/useLiteScene";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/lib/i18n";

export function LiteModeToggle() {
  const { dict } = useTranslation();
  const [mounted, setMounted] = useState(false);
  // The effective setting, so the switch shows what is actually happening
  // rather than only what was chosen by hand. On a device that gets the
  // static backdrop by default this reads as already on, and toggling stores
  // an explicit choice that overrides the detection in either direction.
  const liteMode = useLiteScene();
  const preference = usePreferencesStore((s) => s.liteModePreference);
  const setLiteModePreference = usePreferencesStore((s) => s.setLiteModePreference);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const descriptionText =
    preference === null && liteMode
      ? dict.settings.liteModeDescDefault
      : dict.settings.liteModeDesc;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="lite-mode-switch" className="cursor-pointer text-[13px] font-semibold leading-snug text-white/75">
          {dict.settings.liteMode}
        </label>
        <button
          id="lite-mode-switch"
          type="button"
          role="switch"
          aria-label={dict.settings.liteMode}
          aria-checked={liteMode}
          onClick={() => setLiteModePreference(!liteMode)}
          className={`relative h-6 w-10 shrink-0 rounded-full border transition backdrop-blur-md ${
            liteMode
              ? "border-white/40 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              : "border-white/15 bg-white/10"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition ${
              liteMode ? "left-[19px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>
      <p className="text-[13px] leading-snug text-white/75">{descriptionText}</p>
    </div>
  );
}
