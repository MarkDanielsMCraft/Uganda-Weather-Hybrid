// No zod or other heavy imports here. This runs on every page through the
// place helpers, so it must stay small.
/** Real Ugandan place names and labels never carry phone numbers, links,
    emails, markup, or calls to act. Refusing them keeps planted scam text
    out of the forecast screen, saved places, shared SMS, and the AI
    advisor's instructions. Text is first folded to plain characters (NFKC),
    so wide letters such as "ｈｔｔｐｓ" are caught too. */
const PLACE_TEXT_BLOCKED = /https?:|www\.|@|[<>{}\[\]`\\]|[\u0000-\u001f\u007f]/i;
const PLACE_TEXT_DOMAIN = /\b[\w-]+\.(?:com|ug|net|org|co|io|info|biz|xyz|me|app|link|site|online|top|shop)\b/i;
const PLACE_TEXT_SCAM_WORDS =
  /\b(?:call|whatsapp|send|pay|payment|money|momo|airtime|fee|fees|click|visit|alert|urgent|evacuate|win|prize|loan|password|pin|otp|ignore|instructions?)\b/i;
const HIDDEN_CHARACTERS = /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
const MAX_DIGITS_IN_PLACE_TEXT = 4;
export const MAX_PLACE_NAME_WORDS = 6;
export const MAX_PLACE_LABEL_WORDS = 10;

export function normalizePlaceText(value: string): string {
  return value.normalize("NFKC").replace(HIDDEN_CHARACTERS, "").replace(/\s+/g, " ").trim();
}

export function isSafePlaceText(value: string, maxWords = MAX_PLACE_LABEL_WORDS): boolean {
  const text = normalizePlaceText(value);
  if (PLACE_TEXT_BLOCKED.test(text) || PLACE_TEXT_DOMAIN.test(text) || PLACE_TEXT_SCAM_WORDS.test(text)) {
    return false;
  }
  if (text.split(" ").filter(Boolean).length > maxWords) return false;
  const digits = text.match(/\p{Nd}/gu)?.length ?? 0;
  return digits <= MAX_DIGITS_IN_PLACE_TEXT;
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
