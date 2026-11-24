// No zod or other heavy imports here. This runs on every page through the
// place helpers, so it must stay small.
/** Place names and labels arrive from shared links and saved settings, which
    anyone can write. Blocking bad words always misses some trick (hidden
    characters, spaced letters, other alphabets, lookalike digits), so this
    allows only what real Ugandan place names use: Latin letters (including
    the Luganda ŋ), spaces, apostrophes, hyphens, commas, full stops, and
    brackets, with at most two digits. Anything else is not shown, saved,
    shared, or sent to the AI. */
const INVISIBLE_CHARACTERS = /[\p{Cf}\p{Mn}\p{Me}\u034f\u180e\ufe00-\ufe0f]/gu;
const ALLOWED_PLACE_TEXT = /^[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u017f\u014a\u014b0-9 '\u2019.,()\/-]+$/;
const MAX_DIGITS_IN_PLACE_TEXT = 2;
const MAX_SINGLE_LETTER_WORDS = 2;
/** Long pieces checked on a joined, lowercased copy, so "s.e.n.d m.o.n.e.y"
    and "callnow" style tricks are caught. Only pieces no real place name
    contains: short ones such as "bank" or "momo" appear in real village
    names (Tebankiza, Bumomolo) and are left out. */
const SCAM_FRAGMENTS = [
  "whatsapp", "telegram", "sendmoney", "sendcash", "airtime", "password", "evacuate",
  "instruction", "disregard", "weereza", "kubaessimu", "callnow", "callus", "paynow",
  "mobilemoney", "bitly", "dotcom", "verifyyour",
];
/** Short words refused only as whole words. */
const SCAM_WORDS = new Set([
  "call", "calling", "ring", "dial", "text", "sms", "send", "pay", "payment", "cash",
  "fund", "money", "loan", "bonus", "prize", "donate", "verify", "alert", "urgent",
  "flee", "ignore", "tell", "users", "ssente", "sasula", "kuba", "www", "http", "https",
]);
/** A word made only of letters that look like digits ("OOO", "lZ3") is a
    phone number in disguise, never part of a real name. */
const DIGIT_LOOKALIKE_WORD = /^[0-9OoIlZSB]{3,}$/;
export const MAX_PLACE_NAME_WORDS = 6;
export const MAX_PLACE_LABEL_WORDS = 10;

export function normalizePlaceText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE_CHARACTERS, "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSafePlaceText(value: string, maxWords = MAX_PLACE_LABEL_WORDS): boolean {
  const text = normalizePlaceText(value);
  if (!text || !ALLOWED_PLACE_TEXT.test(text)) return false;
  // "evil.tk" or "scam-help.com". Real names put a space after a full stop.
  if (/[A-Za-z0-9]\.[A-Za-z0-9]/.test(text)) return false;
  const words = text.split(" ").filter(Boolean);
  if (words.length > maxWords) return false;
  if (words.filter((word) => word.replace(/[^A-Za-z]/g, "").length === 1).length > MAX_SINGLE_LETTER_WORDS) {
    return false;
  }
  if ((text.match(/[0-9]/g)?.length ?? 0) > MAX_DIGITS_IN_PLACE_TEXT) return false;
  const lowerWords = text.toLowerCase().split(/[^a-z\u00c0-\u017f\u014b0-9]+/).filter(Boolean);
  if (lowerWords.some((word) => SCAM_WORDS.has(word))) return false;
  if (text.split(/[\s,/()-]+/).some((word) => DIGIT_LOOKALIKE_WORD.test(word.replace(/[.'\u2019]/g, "")))) {
    return false;
  }
  const joined = lowerWords.join("");
  return !SCAM_FRAGMENTS.some((fragment) => joined.includes(fragment));
}

/** For names read from a shared link or saved settings in the browser.
    Returns the cleaned name, or null when it cannot be trusted. */
export function safePlaceName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const text = normalizePlaceText(value);
  if (text.length < 2 || text.length > 120) return null;
  return isSafePlaceText(text, MAX_PLACE_NAME_WORDS) ? text : null;
}

export function safePlaceLabel(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = normalizePlaceText(value);
  if (!text || text.length > 160) return undefined;
  return isSafePlaceText(text, MAX_PLACE_LABEL_WORDS) ? text : undefined;
}

/** Shown instead of a shared name that failed the checks. */
export const SHARED_PLACE_FALLBACK_NAME = "Shared place";
