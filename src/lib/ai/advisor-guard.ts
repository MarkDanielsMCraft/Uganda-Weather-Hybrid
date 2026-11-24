import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";
import type { SupportedLocale } from "@/lib/i18n/types";
import { AIRPORTS, MOUNTAIN_PEAKS, NATIONAL_PARKS } from "@/lib/places/points-of-interest";
import { isSafePlaceText } from "@/lib/validation/schemas";
import type { WeatherBundle } from "@/types/weather";

export interface InstantReply {
  text: string;
  kind: "greeting" | "thanks" | "farewell" | "ack";
}

export type ResolvedAdvisorLocation =
  | {
      kind: "district";
      slug: string;
      name: string;
      isBareLocationQuery: boolean;
      matchedBySpellingCorrection?: boolean;
      typedTerm?: string;
    }
  | {
      kind: "place";
      key: string;
      name: string;
      label: string;
      lat: number;
      lon: number;
      parentDistrictSlug: string;
      isBareLocationQuery: boolean;
      matchedBySpellingCorrection?: boolean;
      typedTerm?: string;
    };

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const RATE_LIMIT_STORAGE_KEY = "uw:advisor-rate:v1";
const MIN_INTERVAL_MS = 2_000;
const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 8;
const DAY_MS = 86_400_000;
const MAX_PER_DAY = 60;

let memoryTimestamps: number[] = [];

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?|directives?)/i,
  /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|directives?)/i,
  /forget\s+(all\s+)?(previous|prior|your|everything)(\s+(instructions?|prompts?|rules?))?/i,
  /(override|bypass|disable)\s+(your\s+)?(rules?|safety|guardrails?|filters?|restrictions?|instructions?)/i,
  /(reveal|show|print|dump|repeat|leak|output|translate)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|instructions?|hidden\s+rules?|api\s+key|secrets?|text\s+above|everything\s+above)/i,
  /what\s+(is|are)\s+your\s+(system\s+prompt|hidden\s+instructions?|internal\s+rules?)/i,
  /\b(jailbreak|dan\s+mode|developer\s+mode|god\s+mode|admin\s+override|system\s+override)\b/i,
  /\b(you\s+are\s+now|you\s+are\s+no\s+longer|stop\s+being\s+a\s+weather|act\s+as\s+a|pretend\s+to\s+be|roleplay\s+as|switch\s+persona)\b/i,
  /\bnew\s+(system\s+)?instructions?\s*:/i,
  /<\s*\/?\s*(system|assistant|instruction|prompt|user_question|script|iframe)\b/i,
  /###\s*(system|instruction|override)/i,
  /(we+rabira|leka\s+okugoberera)\s+amateeka/i,
  /(mbuulira|ndaga)\s+amateeka\s+go\s+ag'omunda/i,
];

const ABUSE_AND_EXPLOIT_PATTERNS: readonly RegExp[] = [
  /\b(drop\s+table|union\s+select|select\s+\*\s+from|insert\s+into\s+\w+|delete\s+from\s+\w+)\b/i,
  /\b(javascript:|onerror\s*=|onload\s*=|document\.cookie|window\.location|eval\s*\(|fromCharCode)\b/i,
  /\b(decode\s+(this\s+)?base64|base64\s+decode|rot13)\b/i,
  /https?:\/\/\S+/i,
  /\b(make\s+a\s+bomb|build\s+a\s+bomb|how\s+to\s+hack|sql\s+injection|phishing\s+email|write\s+malware|ransomware|ddos\s+attack|kill\s+myself|commit\s+suicide)\b/i,
];

const OUTPUT_LEAK_PATTERNS: readonly RegExp[] = [
  /<\/?user_question>/i,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bNEXT_PUBLIC_FIREBASE_/i,
  /\b(Data freshness:|Known location hazards:|Output language:|Spelling note:)\b/,
];

function normalizeInput(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[!?.:,;]+$/g, "").trim().toLowerCase();
}

const MAX_PROMPT_PLACE_TEXT = 80;

/** Place names reach the AI's own instructions, where nothing checks them
    the way the user's question is checked. Text that looks planted (phone
    numbers, links, markup) is dropped, and the rest keeps only the letters
    and punctuation real place names use. */
export function cleanPromptPlaceText(raw: string | undefined): string | undefined {
  if (typeof raw !== "string" || !isSafePlaceText(raw)) return undefined;
  const cleaned = raw
    .replace(/[^\p{L}\p{M}\p{Nd}\s'’.,()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_PLACE_TEXT)
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function withPromptSafePlaceText(weather: WeatherBundle): WeatherBundle {
  const district = weather.district;
  if (!district) return weather;
  const parentName = district.parentDistrictSlug
    ? getDistrictBySlug(district.parentDistrictSlug)?.name
    : undefined;
  return {
    ...weather,
    district: {
      ...district,
      name: cleanPromptPlaceText(district.name) ?? parentName ?? "this place",
      placeLabel: cleanPromptPlaceText(district.placeLabel),
    },
  };
}

export function sanitizeUserMessage(raw: string): string {
  return normalizeInput(raw).replace(/[\u0000-\u001F\u007F]/g, "");
}

const PII_REDACTION_PATTERNS: readonly RegExp[] = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Uganda National ID (NIN: CM/CF + 12 alphanumeric chars)
  /\b(?:CM|CF)[A-Z0-9]{12}\b/gi,
  // Ugandan mobile numbers (+256 7XX XXX XXX or 07XX XXX XXX)
  /(?<!\d)(?:\+?256[\s.-]?|0)7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)/g,
  // International phone numbers (+CC XXX XXX XXXX)
  /(?<!\d)\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/g,
];

/**
 * Strips accidental personal identifiers (emails, Uganda/international phone
 * numbers, and Uganda NINs) before a prompt is sent to cloud inference.
 * Weather metrics, clock times, and district names are untouched.
 */
export function redactPiiForCloud(raw: string): {
  sanitized: string;
  redactedCount: number;
} {
  let sanitized = raw;
  let redactedCount = 0;
  for (const pattern of PII_REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, () => {
      redactedCount += 1;
      return "[redacted]";
    });
  }
  return { sanitized, redactedCount };
}

/** Detects prompt-injection, jailbreak, exploit payloads, phishing links,
    harmful abuse, or character-flood spam before any model call is made. */
export function isPromptInjectionOrAbuse(raw: string): boolean {
  const cleaned = sanitizeUserMessage(raw);
  if (!cleaned) return false;

  // Repetitive spam flood (e.g. 14+ identical characters in a row)
  if (/(.)\1{13,}/.test(cleaned)) {
    return true;
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      return true;
    }
  }

  for (const pattern of ABUSE_AND_EXPLOIT_PATTERNS) {
    if (pattern.test(cleaned)) {
      return true;
    }
  }
  return false;
}

/** Guards against accidental model leakage of internal prompt tags,
    system instructions, or credential-shaped tokens. */
export function containsInternalPromptLeakage(text: string): boolean {
  for (const pattern of OUTPUT_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/** Handles pure greetings, thanks, farewells, and short acknowledgments
    instantly on the client without spending cloud quota or showing a
    "Drafting safety guidance" delay. Returns null if the message contains
    an actual question or topic that needs the model. */
export function matchInstantSocialReply(
  raw: string,
  districtName: string,
  uiLanguage: SupportedLocale,
): InstantReply | null {
  const cleaned = stripTrailingPunctuation(sanitizeUserMessage(raw));
  if (!cleaned || cleaned.length > 48) return null;

  // Luganda thanks
  if (/^(w+e+bale(\s+n+yo)?|mwebale(\s+n+yo)?|webaleko)$/.test(cleaned)) {
    return {
      kind: "thanks",
      text: `Tewali buzibu. Bw'oba olina ekibuuzo ekirala ku mbeera y'obudde e ${districtName}, mbuulira.`,
    };
  }

  // English thanks
  if (/^(thanks|thank you|thank u|thx|ty|cheers|much appreciated|appreciate it)$/.test(cleaned)) {
    return {
      kind: "thanks",
      text:
        uiLanguage === "lg"
          ? `Tewali buzibu. Bw'oba olina ekibuuzo ekirala ku mbeera y'obudde e ${districtName}, mbuulira.`
          : `You are welcome. Ask anytime if you need another weather update for ${districtName}.`,
    };
  }

  // Luganda specific greetings (standard orthography pairs)
  if (/^g+y+ebaleko(\s+n+o)?$/.test(cleaned)) {
    return {
      kind: "greeting",
      text: `Kale, weebale nnyo. Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`,
    };
  }
  if (/^(wasuze\s+otya(\s+n+o)?|mwasuze\s+mutya(\s+n+o)?)$/.test(cleaned)) {
    return {
      kind: "greeting",
      text: `Nasuze bulungi, ate ggwe wasuze otya? Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`,
    };
  }
  if (/^(osiibye\s+otya(\s+n+o)?|musiibye\s+mutya(\s+n+o)?)$/.test(cleaned)) {
    return {
      kind: "greeting",
      text: `Nsiibye bulungi, ate ggwe osiibye otya? Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`,
    };
  }
  if (/^agafa\s+eyo$/.test(cleaned)) {
    return {
      kind: "greeting",
      text: `Malungi gokka. Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`,
    };
  }
  if (/^(oli\s+otya|muli\s+mutya)$/.test(cleaned)) {
    return {
      kind: "greeting",
      text: `Ndi bulungi, weebale kubuuza. Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`,
    };
  }

  // English greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)(\s+(there|how\s+are\s+you|how\s+is\s+it|how\s+u\s+doing))?$|^how\s+are\s+you$/.test(cleaned)) {
    return {
      kind: "greeting",
      text:
        uiLanguage === "lg"
          ? `Oli otya? Nkuyambe ku ki ku mbeera y'obudde e ${districtName}?`
          : `Hello. Ask me about rain, wind, farming, lake safety, or travel in ${districtName}.`,
    };
  }

  // Luganda farewells
  if (/^(weeraba|siiba\s+bulungi|sula\s+bulungi|tunaalabagana)$/.test(cleaned)) {
    return {
      kind: "farewell",
      text: "Weeraba, era weekuume bulungi.",
    };
  }

  // English farewells
  if (/^(bye|goodbye|see you|take care|good night)$/.test(cleaned)) {
    return {
      kind: "farewell",
      text:
        uiLanguage === "lg"
          ? "Weeraba, era weekuume bulungi."
          : `Stay safe. Come back anytime for ${districtName} weather updates.`,
    };
  }

  // Short acknowledgments
  if (/^(kale|ok|okay|alright|got it|cool|noted|sure)$/.test(cleaned)) {
    const respondInLg = uiLanguage === "lg" || cleaned === "kale";
    return {
      kind: "ack",
      text: respondInLg
        ? `Kale. Bw'oba weetaaga amagezi agalala ku mbeera y'obudde e ${districtName}, mbuulira.`
        : `Understood. Ask anytime if you want another weather check for ${districtName}.`,
    };
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

const LOCATION_STOPWORDS = new Set([
  "what",
  "about",
  "how",
  "weather",
  "forecast",
  "today",
  "tonight",
  "tomorrow",
  "morning",
  "afternoon",
  "evening",
  "night",
  "rain",
  "raining",
  "wind",
  "windy",
  "storm",
  "storms",
  "safe",
  "travel",
  "farm",
  "farming",
  "crop",
  "crops",
  "lake",
  "boat",
  "fishing",
  "mountain",
  "park",
  "airport",
  "district",
  "place",
  "there",
  "here",
  "will",
  "should",
  "could",
  "would",
  "please",
  "tell",
  "give",
  "check",
  "show",
  "like",
  "with",
  "from",
  "that",
  "this",
  "embeera",
  "obudde",
  "enkuba",
  "empewo",
  "leero",
  "enkya",
  "ekiro",
  "etudde",
  "etya",
  "bulimi",
  "nnyanja",
  "ensozi",
  "olugendo",
  "amagezi",
  "disitulikiti",
  "waliwo",
  "obulabe",
  "omuyaga",
  "bw'omuyaga",
  "kino",
  "kyangu",
  "okusimba",
  "okusiga",
  "okukaza",
  "okwanika",
  "ebirime",
  "ssaawa",
  "essaawa",
  "ezisinga",
  "okukola",
  "emirimu",
  "ebweru",
  "okuvuba",
  "abavubi",
  "bikuumiro",
  "kkubo",
  "ekkuumiro",
  "obukuumi",
  "buuza",
  "buuliza",
  "okutambula",
  "waggulu",
  "wansi",
  "kati",
  "bulungi",
  "nnyo",
  "kibuga",
  "ekibuga",
]);

/** Resolves a Uganda district, national park, mountain peak, or airport
    referenced in a user's chat message, including bare district queries,
    4+ character prefixes ("What of Bukoma" -> "Bukomansimbi"), and typo
    corrections ("Kampalla" -> "Kampala", "Entebe" -> "Entebbe"). */
export function resolveReferencedUgandaLocation(
  raw: string,
): ResolvedAdvisorLocation | null {
  const cleaned = stripTrailingPunctuation(sanitizeUserMessage(raw));
  if (!cleaned) return null;

  const districts = getAllDistricts();
  const allPlaces = [...NATIONAL_PARKS, ...MOUNTAIN_PEAKS, ...AIRPORTS];

  // Strip common leading weather phrasing to check if the user is asking
  // specifically about a named district or place.
  const strippedCandidate = cleaned
    .replace(
      /^(what\s+is\s+the\s+weather\s+in|how\s+is\s+the\s+weather\s+in|what\s+about|what\s+of|how\s+about|how\s+is|weather\s+in|weather\s+for|forecast\s+for|forecast\s+in|embeera\s+y'obudde\s+e|obudde\s+bw'e|obudde\s+e|enkuba\s+e|empewo\s+e|ate\s+e|ate)\s+/i,
      "",
    )
    .trim();

  const isBareLocationQuery =
    strippedCandidate.split(/\s+/).length <= 3 &&
    (strippedCandidate === cleaned || strippedCandidate.length < cleaned.length);

  // 1. Exact district name or slug match on the candidate
  const exactDistrict = districts.find(
    (d) =>
      d.name.toLowerCase() === strippedCandidate ||
      d.slug.toLowerCase() === strippedCandidate ||
      d.name.toLowerCase().replace(/\s+city$/i, "") === strippedCandidate,
  );
  if (exactDistrict) {
    return {
      kind: "district",
      slug: exactDistrict.slug,
      name: exactDistrict.name,
      isBareLocationQuery: true,
    };
  }

  // 2. Exact place name or key match on the candidate
  const exactPlace = allPlaces.find(
    (p) =>
      p.name.toLowerCase() === strippedCandidate ||
      p.key.toLowerCase() === strippedCandidate,
  );
  if (exactPlace) {
    return {
      kind: "place",
      key: exactPlace.key,
      name: exactPlace.name,
      label: exactPlace.label,
      lat: exactPlace.lat,
      lon: exactPlace.lon,
      parentDistrictSlug: exactPlace.parentDistrictSlug,
      isBareLocationQuery: true,
    };
  }

  // 3. Substring / word-boundary exact mention of a district or place inside a
  // full sentence (e.g. "Will it rain in Bukomansimbi tonight?").
  const districtsLongestFirst = [...districts].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const district of districtsLongestFirst) {
    const pattern = new RegExp(`\\b${escapeRegExp(district.name.toLowerCase())}\\b`, "i");
    if (pattern.test(cleaned)) {
      return {
        kind: "district",
        slug: district.slug,
        name: district.name,
        isBareLocationQuery: false,
      };
    }
  }

  const placesLongestFirst = [...allPlaces].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const place of placesLongestFirst) {
    const pattern = new RegExp(`\\b${escapeRegExp(place.name.toLowerCase())}\\b`, "i");
    if (pattern.test(cleaned)) {
      return {
        kind: "place",
        key: place.key,
        name: place.name,
        label: place.label,
        lat: place.lat,
        lon: place.lon,
        parentDistrictSlug: place.parentDistrictSlug,
        isBareLocationQuery: false,
      };
    }
  }

  // 4. Prefix or fuzzy spelling match on candidate words (e.g. "What of Bukoma"
  // -> "Bukomansimbi", "How is Kampalla" -> "Kampala", "Entebe" -> "Entebbe").
  const candidateTokens = strippedCandidate
    .split(/[^a-z0-9'-]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 4 && !LOCATION_STOPWORDS.has(token));

  // Prefer prefix matches first (e.g. "bukoma" -> "Bukomansimbi", "bwindi" -> "Bwindi")
  for (const token of candidateTokens) {
    const prefixDistrict = districts.find(
      (d) =>
        d.name.toLowerCase().startsWith(token) ||
        d.slug.toLowerCase().startsWith(token),
    );
    if (prefixDistrict) {
      return {
        kind: "district",
        slug: prefixDistrict.slug,
        name: prefixDistrict.name,
        isBareLocationQuery,
        matchedBySpellingCorrection: true,
        typedTerm: token,
      };
    }

    const prefixPlace = allPlaces.find(
      (p) =>
        p.name.toLowerCase().startsWith(token) ||
        p.key.toLowerCase().startsWith(token) ||
        p.name
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.length >= 4 && word.startsWith(token)),
    );
    if (prefixPlace) {
      return {
        kind: "place",
        key: prefixPlace.key,
        name: prefixPlace.name,
        label: prefixPlace.label,
        lat: prefixPlace.lat,
        lon: prefixPlace.lon,
        parentDistrictSlug: prefixPlace.parentDistrictSlug,
        isBareLocationQuery,
        matchedBySpellingCorrection:
          prefixPlace.name.toLowerCase() !== token &&
          !prefixPlace.name
            .toLowerCase()
            .split(/\s+/)
            .some((word) => word === token),
        typedTerm: token,
      };
    }
  }

  // Fuzzy Levenshtein edit-distance match for misspelled district names
  let bestDistrict: { district: (typeof districts)[number]; dist: number; token: string } | null =
    null;

  for (const token of candidateTokens) {
    const maxDist = token.length >= 6 ? 2 : 1;
    for (const district of districts) {
      const baseName = district.name.toLowerCase().replace(/\s+city$/i, "");
      if (Math.abs(baseName.length - token.length) > maxDist) continue;
      if (baseName[0] !== token[0]) continue;
      const dist = levenshteinDistance(token, baseName);
      if (dist <= maxDist && (!bestDistrict || dist < bestDistrict.dist)) {
        bestDistrict = { district, dist, token };
      }
    }
  }

  if (bestDistrict) {
    return {
      kind: "district",
      slug: bestDistrict.district.slug,
      name: bestDistrict.district.name,
      isBareLocationQuery,
      matchedBySpellingCorrection: true,
      typedTerm: bestDistrict.token,
    };
  }

  return null;
}

function readTimestamps(now: number): number[] {
  let stored = memoryTimestamps;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          stored = parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
        }
      }
    } catch {
      // Fallback to in-memory timestamps
    }
  }
  return stored.filter((ts) => now - ts < DAY_MS);
}

function writeTimestamps(timestamps: number[]): void {
  memoryTimestamps = timestamps;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(timestamps));
    } catch {
      // Ignore storage quota errors
    }
  }
}

/** Enforces client-side cooldown (2s), burst limit (8/min), and daily cap
    (60/day) before spending Firebase AI Logic quota. */
export function checkAndRecordAdvisorRateLimit(now = Date.now()): RateLimitResult {
  const recent = readTimestamps(now);
  const last = recent[recent.length - 1];

  if (typeof last === "number" && now - last < MIN_INTERVAL_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000)),
    };
  }

  const inLastMinute = recent.filter((ts) => now - ts < WINDOW_MS);
  if (inLastMinute.length >= MAX_PER_MINUTE) {
    const oldestInWindow = inLastMinute[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldestInWindow)) / 1000)),
    };
  }

  if (recent.length >= MAX_PER_DAY) {
    return {
      allowed: false,
      retryAfterSeconds: 3600,
    };
  }

  writeTimestamps([...recent, now]);
  return { allowed: true };
}

export function resetAdvisorRateLimitForTests(): void {
  memoryTimestamps = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
