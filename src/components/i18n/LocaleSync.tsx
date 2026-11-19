"use client";

import { useEffect } from "react";
import type { SupportedLocale } from "@/lib/i18n/types";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Syncs route-level locale into the HTML lang attribute and client store on entry. */
export function LocaleSync({ locale }: { locale: SupportedLocale }) {
  const setUiLanguage = usePreferencesStore((s) => s.setUiLanguage);

  useEffect(() => {
    document.documentElement.lang = locale;
    setUiLanguage(locale);
  }, [locale, setUiLanguage]);

  return null;
}
