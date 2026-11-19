"use client";

import { usePreferencesStore } from "@/stores/preferencesStore";
import { en } from "./dictionaries/en";
import { lg } from "./dictionaries/lg";
import { interpolate } from "./interpolate";
import type { SupportedLocale, TranslationDictionary } from "./types";

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en,
  lg,
};

/**
 * Retrieve dictionary for a specific locale without hooks (useful for static/SSR contexts).
 */
export function getDictionary(locale: SupportedLocale): TranslationDictionary {
  return DICTIONARIES[locale] ?? en;
}

/**
 * Access localized dictionary and safe parameter interpolation helper.
 */
export function useTranslation() {
  const uiLanguage = usePreferencesStore((state) => state.uiLanguage);
  const setUiLanguage = usePreferencesStore((state) => state.setUiLanguage);

  const dict = DICTIONARIES[uiLanguage] ?? en;

  function t(
    path: string,
    params?: Record<string, string | number>,
  ): string {
    const keys = path.split(".");
    let current: unknown = dict;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Fallback to English dictionary if key is missing in active locale
        let fallback: unknown = en;
        for (const fbKey of keys) {
          if (fallback && typeof fallback === "object" && fbKey in fallback) {
            fallback = (fallback as Record<string, unknown>)[fbKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== "string") {
      return path;
    }

    return interpolate(current, params);
  }

  return {
    dict,
    t,
    uiLanguage,
    setUiLanguage,
  };
}
