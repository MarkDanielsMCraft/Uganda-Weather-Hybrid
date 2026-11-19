import type { SupportedLocale, TranslationDictionary } from "./types";

export * from "./types";
export * from "./interpolate";
export * from "./useTranslation";
export { en } from "./dictionaries/en";
export { lg } from "./dictionaries/lg";

export function localizeDistrictName(
  name: string,
  dict: Pick<TranslationDictionary, "common">,
): string {
  return name === "Your location" ? dict.common.yourLocation : name;
}

export function formatDistrictPhrase(
  template: string,
  rawDistrictName: string,
  dict: Pick<TranslationDictionary, "common">,
  language: SupportedLocale,
): string {
  const name = localizeDistrictName(rawDistrictName, dict);
  if (
    language === "lg" &&
    (rawDistrictName === "Your location" || rawDistrictName === dict.common.yourLocation)
  ) {
    if (/\bne \{district\}/.test(template)) {
      return template.replace(/\bne \{district\}/, "n'ekifo w'oli");
    }
    if (/\bmu \{district\}/.test(template)) {
      return template.replace(/\bmu \{district\}/, "mu kifo w'oli");
    }
    if (/\be \{district\}/.test(template)) {
      return template.replace(/\be \{district\}/, "mu kifo w'oli");
    }
  }
  return template.replace("{district}", name);
}
