"use client";

import { useEffect, useId, useState } from "react";
import { GlassSelect, type GlassSelectOption } from "@/components/glass/GlassSelect";
import { useTranslation } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n/types";

const LANGUAGE_SELECT_OPTIONS: readonly GlassSelectOption<SupportedLocale>[] = [
  { value: "en", label: "English" },
  { value: "lg", label: "Luganda" },
];

export function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { uiLanguage, setUiLanguage, dict } = useTranslation();
  const labelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        id={labelId}
        className="truncate text-[12.5px] font-semibold leading-tight text-white/75"
      >
        {dict.settings.language}
      </span>
      <GlassSelect<SupportedLocale>
        value={uiLanguage}
        options={LANGUAGE_SELECT_OPTIONS}
        onChange={(next) => setUiLanguage(next)}
        ariaLabelledBy={labelId}
        triggerClassName="min-h-[34px] w-full rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      />
    </div>
  );
}
