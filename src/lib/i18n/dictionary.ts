// Plain module with no "use client" line, so server routes (farming advice,
// weather source text, storm alerts) can read the same words as the screens.
// Importing these from the client hook file made them unusable on the server.
import { en } from "./dictionaries/en";
import { lg } from "./dictionaries/lg";
import type { SupportedLocale, TranslationDictionary } from "./types";

export const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en,
  lg,
};

export function getDictionary(locale: SupportedLocale): TranslationDictionary {
  return DICTIONARIES[locale] ?? en;
}
