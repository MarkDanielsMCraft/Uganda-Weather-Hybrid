import { lugandaTimeParts, parseClockLabelTo24h } from "@/lib/time/uganda";

const ONES_LG: Record<number, string> = {
  0: "zzeero",
  1: "emu",
  2: "bbiri",
  3: "ssatu",
  4: "nnya",
  5: "ttaano",
  6: "mukaaga",
  7: "musanvu",
  8: "munaana",
  9: "mwenda",
};

/** Class 8 (bi-) numeral concords for 'bikumi' (hundreds: 200..900). */
const HUNDREDS_UNITS_LG: Record<number, string> = {
  2: "bibiri",
  3: "bisatu",
  4: "bina",
  5: "bitaano",
  6: "mukaaga",
  7: "musanvu",
  8: "munaana",
  9: "mwenda",
};

/** Class 3/4 (mu-/mi-) numeral concords for 'mutwalo' / 'mitwalo' (ten-thousands). */
const MITWALO_UNITS_LG: Record<number, string> = {
  1: "gumu",
  2: "ebiri",
  3: "esatu",
  4: "ena",
  5: "etaano",
  6: "mukaaga",
  7: "musanvu",
  8: "munaana",
  9: "mwenda",
};

/** Class 14 (bu-) numeral concords for 'bukadde' (millions: 2..9). */
const BUKADDE_UNITS_LG: Record<number, string> = {
  2: "bubiri",
  3: "busatu",
  4: "buna",
  5: "butaano",
  6: "mukaaga",
  7: "musanvu",
  8: "munaana",
  9: "mwenda",
};

const TENS_LG: Record<number, string> = {
  10: "kkumi",
  20: "abiri",
  30: "asatu",
  40: "ana",
  50: "ataano",
  60: "nkaaga",
  70: "nsanvu",
  80: "kinaana",
  90: "kyenda",
  100: "kikumi",
};

function formatCompactPeriodGenitiveLg(code: string, hour: number): string {
  const isSingularHour = Math.round(hour) === 1;
  switch (code) {
    case "mk":
      return isSingularHour ? "eyokumakya" : "ezokumakya";
    case "tt":
      return isSingularHour ? "eyomuttuntu" : "ezomuttuntu";
    case "lg":
      return isSingularHour ? "ey'olweggulo" : "ez'olweggulo";
    case "kw":
      return isSingularHour ? "ey'akawungeezi" : "ez'akawungeezi";
    case "kr":
      return isSingularHour ? "ey'ekiro" : "ez'ekiro";
    case "tb":
      return isSingularHour ? "eyomuttumbi" : "ezomuttumbi";
    default:
      return isSingularHour ? "eyokumakya" : "ezokumakya";
  }
}

function formatMitwaloCountLg(count: number): string {
  if (count === 1) return "mutwalo gumu";
  if (count <= 9) return `mitwalo ${MITWALO_UNITS_LG[count] ?? ONES_LG[count]}`;
  if (count === 10) return "mitwalo kkumi";
  if (count < 20) {
    const unit = count - 10;
    const teenSuffix: Record<number, string> = {
      1: "n'ogumu",
      2: "n'ebiri",
      3: "n'esatu",
      4: "n'ena",
      5: "n'etaano",
    };
    return `mitwalo kkumi ${teenSuffix[unit] ?? `na ${ONES_LG[unit]}`}`;
  }
  const tens = Math.floor(count / 10) * 10;
  const unit = count % 10;
  const tensWord = TENS_LG[tens] ?? "";
  if (unit === 0) return `mitwalo ${tensWord}`;
  return `mitwalo ${tensWord} mu ${MITWALO_UNITS_LG[unit] ?? ONES_LG[unit]}`;
}

export function numberToLugandaWords(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `${numberToLugandaWords(Math.abs(n))} wansi wa zzeero`;
  if (n <= 9) return ONES_LG[n] ?? String(n);
  if (n === 10) return "kkumi";
  if (n < 20) {
    const unit = n - 10;
    return unit === 1 ? "kkumi n'emu" : `kkumi na ${ONES_LG[unit]}`;
  }
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const unit = n % 10;
    const tensWord = TENS_LG[tens] ?? "";
    if (unit === 0) return tensWord;
    return `${tensWord} mu ${ONES_LG[unit]}`;
  }
  if (n === 100) return "kikumi";
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const prefix =
      hundreds === 1
        ? "kikumi"
        : `bikumi ${HUNDREDS_UNITS_LG[hundreds] ?? ONES_LG[hundreds]}`;
    return rest === 0 ? prefix : `${prefix} mu ${numberToLugandaWords(rest)}`;
  }
  if (n < 10000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const thousandPrefix =
      thousands === 1
        ? "lukumi"
        : `nkumi ${ONES_LG[thousands] ?? numberToLugandaWords(thousands)}`;
    return rest === 0
      ? thousandPrefix
      : `${thousandPrefix} mu ${numberToLugandaWords(rest)}`;
  }
  if (n < 1_000_000) {
    const tenThousands = Math.floor(n / 10_000);
    const rest = n % 10_000;
    const prefix = formatMitwaloCountLg(tenThousands);
    return rest === 0 ? prefix : `${prefix} mu ${numberToLugandaWords(rest)}`;
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const millionPrefix =
      millions === 1
        ? "kakadde kamu"
        : millions <= 9
          ? `bukadde ${BUKADDE_UNITS_LG[millions] ?? ONES_LG[millions]}`
          : `bukadde ${numberToLugandaWords(millions)}`;
    return rest === 0
      ? millionPrefix
      : `${millionPrefix} mu ${numberToLugandaWords(rest)}`;
  }
  return String(n);
}

function formatSpokenLugandaEquatorialTime(hour24: number, minute: number): string {
  const { lugandaHour, minute: safeM, genitivePeriod } = lugandaTimeParts(
    hour24,
    minute,
  );
  const hourWords = numberToLugandaWords(lugandaHour);
  if (safeM === 0) {
    return `ssaawa ${hourWords} ${genitivePeriod}`;
  }
  const minWords = numberToLugandaWords(safeM);
  return `ssaawa ${hourWords} n'eddakiika ${minWords} ${genitivePeriod}`;
}

function formatSpokenAlreadyShiftedLugandaClock(
  lugandaHourRaw: number,
  minuteRaw: number,
  connectorRaw: string,
): string {
  const h = Math.max(1, Math.min(12, Math.round(lugandaHourRaw)));
  const m = Math.max(0, Math.min(59, Math.round(minuteRaw)));
  const conn = h === 1 ? "ey'" : connectorRaw || "ez'";
  const hourWords = numberToLugandaWords(h);
  if (m === 0) {
    return `ssaawa ${hourWords} ${conn}`;
  }
  return `ssaawa ${hourWords} n'eddakiika ${numberToLugandaWords(m)} ${conn}`;
}

function decimalToLugandaWords(intStr: string, decStr: string): string {
  const intWords = numberToLugandaWords(Number(intStr));
  const decDigits = decStr
    .split("")
    .map((ch) => numberToLugandaWords(Number(ch)))
    .join(" ");
  return `${intWords} n'akatundu ${decDigits}`;
}

/**
 * Normalizes Luganda weather text into natural spoken Luganda words so
 * neural TTS models never stumble on raw digits, English AM/PM clock times,
 * degrees symbols, or English unit abbreviations.
 */
export function normalizeLugandaForSpeech(text: string): string {
  return (
    text
      // Strip redundant English parenthetical glosses used in UI explanations
      .replace(/\s*\((?:Equator|dew point|O3|NO2|CO)\)/gi, "")
      // Turn visual middle dots and long dashes into spoken comma pauses
      .replace(/\s*[·•—–]\s*/g, ", ")
      // Strip thousands commas inside multi-digit numbers (e.g. "2,607", "356,500")
      .replace(/\b(\d{1,3})(?:,(\d{3}))+\b/g, (match) => match.replace(/,/g, ""))
      // Place titles (bounded non-overlapping word groups to prevent ReDoS)
      .replace(/\b([A-Za-z][A-Za-z'-]{0,30}(?: [A-Za-z][A-Za-z'-]{0,30}){0,2}) City\b/g, "Ekibuga $1")
      .replace(/\b([A-Za-z][A-Za-z'-]{0,30}(?: [A-Za-z][A-Za-z'-]{0,30}){0,2}) District\b/g, "Disitulikiti y'e $1")
      // Air-quality particulate labels before generic decimals/integers
      .replace(/\bPM2\.5\b/gi, "P M bbiri n'akatundu ttaano")
      .replace(/\bPM10\b/gi, "P M kkumi")
      // UI duration shorthand ("ss. 12 ddak. 5", "ddak. 25")
      .replace(/\bss\.\s*(\d+)\s+ddak\.\s*(\d+)\b/gi, (_, hStr: string, mStr: string) => {
        const h = Number(hStr);
        const m = Number(mStr);
        if (m === 0) return `essaawa ${numberToLugandaWords(h)}`;
        return `essaawa ${numberToLugandaWords(h)} n'eddakiika ${numberToLugandaWords(m)}`;
      })
      .replace(
        /\bddak\.\s*(\d+)\b/gi,
        (_, mStr: string) => `eddakiika ${numberToLugandaWords(Number(mStr))}`,
      )
      // Strip duplicate "ssaawa" before time conversion if already present
      .replace(
        /\b(?:ku\s+)?ssaawa\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi,
        (_, clock: string) => {
          const parsed = parseClockLabelTo24h(clock);
          if (!parsed) return clock;
          return `ku ${formatSpokenLugandaEquatorialTime(parsed.hour24, parsed.minute)}`;
        },
      )
      // Any remaining English 12-hour AM/PM clock time (e.g., "6:39 AM", "8:00 am", "9 pm")
      .replace(
        /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi,
        (full) => {
          const parsed = parseClockLabelTo24h(full);
          if (!parsed) return full;
          return formatSpokenLugandaEquatorialTime(parsed.hour24, parsed.minute);
        },
      )
      // Already-shifted Luganda clock strings (all 6 periods including evening/afternoon/night)
      .replace(
        /\b(?:ssaawa\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s+(ey'akawungeezi|ez'akawungeezi|ey'olweggulo|ez'olweggulo|ey'ekiro|ez'ekiro|eyokumakya|ezokumakya|eyomuttuntu|ezomuttuntu|eyomuttumbi|ezomuttumbi|ey'|ez')/gi,
        (_, hStr: string, mStr: string, suffix: string) => {
          const h = Math.max(1, Math.min(12, Math.round(Number(hStr))));
          const m = Math.max(0, Math.min(59, Math.round(Number(mStr))));
          if (suffix === "ey'" || suffix === "ez'") {
            return formatSpokenAlreadyShiftedLugandaClock(h, m, suffix);
          }
          const normalizedSuffix =
            h === 1
              ? suffix.replace(/^ez/i, "ey")
              : suffix.replace(/^ey/i, "ez");
          const hourWords = numberToLugandaWords(h);
          if (m === 0) {
            return `ssaawa ${hourWords} ${normalizedSuffix}`;
          }
          return `ssaawa ${hourWords} n'eddakiika ${numberToLugandaWords(m)} ${normalizedSuffix}`;
        },
      )
      // Compact Luganda clock labels (e.g. "2 kr", "3 mk", "8 tt", "10 lg", "12 kw", "9 tb")
      .replace(
        /\b(\d{1,2})(?::(\d{2}))?\s+(mk|tt|lg|kw|kr|tb)\b/g,
        (_, hStr: string, mStr: string | undefined, code: string) => {
          const h = Number(hStr);
          const m = mStr ? Number(mStr) : 0;
          const genitivePeriod = formatCompactPeriodGenitiveLg(code, h);
          const hourWords = numberToLugandaWords(Math.max(1, Math.min(12, Math.round(h))));
          if (m === 0) {
            return `ssaawa ${hourWords} ${genitivePeriod}`;
          }
          return `ssaawa ${hourWords} n'eddakiika ${numberToLugandaWords(m)} ${genitivePeriod}`;
        },
      )
      // Temperature ranges like "18° / 26°" or "18°C / 26°C"
      .replace(
        /(-?\d+)\s*°\s*C?\s*\/\s*(-?\d+)\s*°\s*C?/gi,
        (_, low: string, high: string) =>
          `okuva ku ddiguli ${numberToLugandaWords(Number(low))} okutuuka ku ddiguli ${numberToLugandaWords(Number(high))}`,
      )
      // Prevent doubling "ddiguli ddiguli" when text already has "ddiguli" before a degree number
      .replace(
        /\bddiguli\s+(-?\d+)\s*°\s*[CF]?\b/gi,
        (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`,
      )
      // Negative degrees (e.g. "-3°C", "-3°") without regex lookbehind for iOS 15 Safari compatibility
      .replace(
        /(^|[^\w])-(\d+)\s*°\s*(?:[CF]\b)?/gi,
        (_, prefix: string, d: string) =>
          `${prefix}ddiguli ${numberToLugandaWords(Number(d))} wansi wa zzeero`,
      )
      // Positive signed degrees (e.g. "+2°")
      .replace(
        /\+(\d+)\s*°\s*[CF]?\b/gi,
        (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`,
      )
      // Standard degrees ("25°C", "25°F", "25°", "25 degrees Celsius", "25 degrees")
      .replace(/(\d+)\s*°\s*C\b/gi, (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`)
      .replace(/(\d+)\s*°\s*F\b/gi, (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`)
      .replace(/(\d+)\s*°/g, (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`)
      .replace(
        /(\d+)\s+degrees?(?:\s+celsius|\s+fahrenheit)?\b/gi,
        (_, d: string) => `ddiguli ${numberToLugandaWords(Number(d))}`,
      )
      // Percentages ("80%", "80 percent")
      .replace(
        /(\d+)\s*(?:%|\bpercent\b)/gi,
        (_, d: string) => `ebitundu ${numberToLugandaWords(Number(d))} ku kikumi`,
      )
      // Speeds (prefix-first "km/h 12" / "km/h12" and suffix "12 km/h", "mm/h 2.5" and "2.5 mm/h")
      .replace(
        /\bkm\/h\s*(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `kilomiita ${decimalToLugandaWords(i, f)} buli ssaawa`,
      )
      .replace(
        /\bkm\/h\s*(\d+)\b/gi,
        (_, d: string) => `kilomiita ${numberToLugandaWords(Number(d))} buli ssaawa`,
      )
      .replace(
        /(\d+)\.(\d+)\s*km\/h\b/gi,
        (_, i: string, f: string) => `kilomiita ${decimalToLugandaWords(i, f)} buli ssaawa`,
      )
      .replace(
        /(\d+)\s*km\/h\b/gi,
        (_, d: string) => `kilomiita ${numberToLugandaWords(Number(d))} buli ssaawa`,
      )
      .replace(
        /\bmm\/h\s*(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `milimiita ${decimalToLugandaWords(i, f)} buli ssaawa`,
      )
      .replace(
        /\bmm\/h\s*(\d+)\b/gi,
        (_, d: string) => `milimiita ${numberToLugandaWords(Number(d))} buli ssaawa`,
      )
      .replace(
        /(\d+)\.(\d+)\s*mm\/h\b/gi,
        (_, i: string, f: string) => `milimiita ${decimalToLugandaWords(i, f)} buli ssaawa`,
      )
      .replace(
        /(\d+)\s*mm\/h\b/gi,
        (_, d: string) => `milimiita ${numberToLugandaWords(Number(d))} buli ssaawa`,
      )
      // Micrograms per cubic meter ("µg/m³ 14", "14 µg/m³", "ug/m3 14")
      .replace(
        /(?:µg\/m³|μg\/m³|ug\/m3)\s*(\d+)\.(\d+)/gi,
        (_, i: string, f: string) => `mayikurogulaamu ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /(\d+)\.(\d+)\s*(?:µg\/m³|μg\/m³|ug\/m3)/gi,
        (_, i: string, f: string) => `mayikurogulaamu ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /(?:µg\/m³|μg\/m³|ug\/m3)\s*(\d+)/gi,
        (_, d: string) => `mayikurogulaamu ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /(\d+)\s*(?:µg\/m³|μg\/m³|ug\/m3)/gi,
        (_, d: string) => `mayikurogulaamu ${numberToLugandaWords(Number(d))}`,
      )
      // Aviation knots ("kt 8", "8 kt") and statute miles ("SM 10+", "SM 6", "10 SM")
      .replace(
        /\bkt\s*(\d+)\b/gi,
        (_, d: string) => `nooti ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /\b(\d+)\s*kt\b/gi,
        (_, d: string) => `nooti ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /\bSM\s*(\d+)\+/g,
        (_, d: string) => `maayiro ${numberToLugandaWords(Number(d))} n'okusoba`,
      )
      .replace(
        /\b(\d+)\+\s*SM\b/g,
        (_, d: string) => `maayiro ${numberToLugandaWords(Number(d))} n'okusoba`,
      )
      .replace(
        /\bSM\s*(\d+)\.(\d+)\b/g,
        (_, i: string, f: string) => `maayiro ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\b(\d+)\.(\d+)\s*SM\b/g,
        (_, i: string, f: string) => `maayiro ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\bSM\s*(\d+)\b/g,
        (_, d: string) => `maayiro ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /\b(\d+)\s*SM\b/g,
        (_, d: string) => `maayiro ${numberToLugandaWords(Number(d))}`,
      )
      // Millimeters & Kilometers & Meters (prefix-first and suffix)
      .replace(
        /\bmilimiita\s+(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `milimiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\bmm\s*(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `milimiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\bmm\s*(\d+)\b/gi,
        (_, d: string) => `milimiita ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /(\d+)\.(\d+)\s*mm\b/gi,
        (_, i: string, f: string) => `milimiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /(\d+)\s*mm\b/gi,
        (_, d: string) => `milimiita ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /\bkilomii?ta\s+(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `kilomiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\bkm\s*(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `kilomiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /\bkm\s*(\d+)\b/gi,
        (_, d: string) => `kilomiita ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /(\d+)\.(\d+)\s*km\b/gi,
        (_, i: string, f: string) => `kilomiita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /(\d+)\s*km\b/gi,
        (_, d: string) => `kilomiita ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /\bmita\s+(\d+)\.(\d+)\b/gi,
        (_, i: string, f: string) => `mita ${decimalToLugandaWords(i, f)}`,
      )
      .replace(
        /(\d+)\.(\d+)\s*m\b/g,
        (_, i: string, f: string) => `mita ${decimalToLugandaWords(i, f)}`,
      )
      // Pressure ("mb 900", "mb900", "mb +2", "hPa 1014", "1014 hPa")
      .replace(
        /\b(?:mba?|hpa)\s*\+?(-?\d+)\b/gi,
        (_, d: string) => `miliba ${numberToLugandaWords(Number(d))}`,
      )
      .replace(
        /(-?\d+)\s*(?:mb|hpa)\b/gi,
        (_, d: string) => `miliba ${numberToLugandaWords(Number(d))}`,
      )
      // Open-ended scale caps like "150+"
      .replace(
        /\b(\d+)\+(?!\w)/g,
        (_, d: string) => `${numberToLugandaWords(Number(d))} n'okusoba`,
      )
      // Remaining decimal numbers
      .replace(
        /\b(\d+)\.(\d+)\b/g,
        (_, i: string, f: string) => decimalToLugandaWords(i, f),
      )
      // Remaining standalone integers
      .replace(/\b(\d+)\b/g, (_, d: string) => numberToLugandaWords(Number(d)))
      .replace(/\s+/g, " ")
      .trim()
  );
}
