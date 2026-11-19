import type { SupportedLocale } from "@/lib/i18n/types";

/** Uganda uses Africa/Kampala (UTC+3, no daylight saving). */
export const UGANDA_TIMEZONE = "Africa/Kampala";
export const UGANDA_UTC_OFFSET = "+03:00";

const LUGANDA_WEEKDAYS = [
  "Ssande",
  "Bbalaza",
  "Olwokubiri",
  "Olwokusatu",
  "Olwokuna",
  "Olwokutaano",
  "Olwomukaaga",
] as const;

const LUGANDA_WEEKDAYS_SHORT = [
  "Ssa",
  "Bba",
  "Okb",
  "Oks",
  "Okn",
  "Okt",
  "Owm",
] as const;

const LUGANDA_MONTHS_SHORT = [
  "Gatonnya",
  "Mukutulansanja",
  "Mugulansigo",
  "Kafuumuulampawu",
  "Muzigo",
  "Ssebaaseka",
  "Kasaambula",
  "Muwakanya",
  "Mutunda",
  "Mukulukusabitungotungo",
  "Museenene",
  "Ntenvu",
] as const;

export type LugandaClockStyle = "compact" | "medium";

function kampalaParts(date: Date): {
  year: number;
  monthIndex: number;
  day: number;
  hour24: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UGANDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getNum = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getNum("year"),
    monthIndex: Math.max(0, getNum("month") - 1),
    day: getNum("day"),
    hour24: getNum("hour") % 24,
    minute: getNum("minute"),
    second: getNum("second"),
  };
}

/** Luganda equatorial 6-hour-shifted clock + grammatical Class 9/10 concord (`ey'` for 1 vs `ez'` for 2-12). */
export function lugandaTimeParts(hour24: number, minute = 0) {
  const safeH = Number.isFinite(hour24) ? Math.trunc(hour24) : 0;
  const safeM = Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.trunc(minute))) : 0;
  const h = ((safeH % 24) + 24) % 24;
  const lugandaHour = ((h + 5) % 12) + 1;
  const connector = lugandaHour === 1 ? "ey'" : "ez'";

  let period = "oku makya";
  let shortPeriod = "mk";
  if (h >= 0 && h <= 4) {
    period = "omu ttumbi";
    shortPeriod = "tb";
  } else if (h >= 5 && h <= 11) {
    period = "oku makya";
    shortPeriod = "mk";
  } else if (h >= 12 && h <= 15) {
    period = "omu ttuntu";
    shortPeriod = "tt";
  } else if (h >= 16 && h <= 17) {
    period = "olweggulo";
    shortPeriod = "lg";
  } else if (h === 18) {
    period = "akawungeezi";
    shortPeriod = "kw";
  } else {
    period = "ekiro";
    shortPeriod = "kr";
  }

  return {
    lugandaHour,
    minute: safeM,
    paddedMinute: String(safeM).padStart(2, "0"),
    connector,
    period,
    shortPeriod,
  };
}

export function formatLugandaClockParts(
  hour24: number,
  minute = 0,
  style: LugandaClockStyle = "medium",
  second?: number,
): string {
  const { lugandaHour, minute: safeM, paddedMinute, connector, period, shortPeriod } =
    lugandaTimeParts(hour24, minute);
  if (style === "compact") {
    return safeM === 0
      ? `${lugandaHour} ${shortPeriod}`
      : `${lugandaHour}:${paddedMinute} ${shortPeriod}`;
  }
  const secSuffix = second != null ? `:${String(second).padStart(2, "0")}` : "";
  return `${lugandaHour}:${paddedMinute}${secSuffix} ${connector}${period}`;
}

export function parseClockLabelTo24h(label: string): { hour24: number; minute: number } | null {
  const trimmed = label.trim();
  const twelveHourMatch = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(trimmed);
  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? "0");
    if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) return null;
    let hour = rawHour % 12;
    if (/pm/i.test(twelveHourMatch[3])) hour += 12;
    return { hour24: hour, minute };
  }
  const twentyFourMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (twentyFourMatch) {
    const hour24 = Number(twentyFourMatch[1]);
    const minute = Number(twentyFourMatch[2]);
    if (hour24 >= 0 && hour24 <= 23 && minute >= 0 && minute <= 59) {
      return { hour24, minute };
    }
  }
  return null;
}

export function formatClockLabelForLanguage(
  label: string,
  language: SupportedLocale,
  style: LugandaClockStyle = "medium",
): string {
  if (language !== "lg") return label;
  if (label.trim().toLowerCase() === "now") return "Kati";
  const parsed = parseClockLabelTo24h(label);
  if (!parsed) return label;
  return formatLugandaClockParts(parsed.hour24, parsed.minute, style);
}

export function formatDurationForLanguage(totalMinutes: number, language: SupportedLocale): string {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  if (language === "lg") {
    if (hours <= 0) return `ddak. ${minutes}`;
    return `ss. ${hours} ddak. ${minutes}`;
  }
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Parse WeatherAPI local datetime strings (always Africa/Kampala). */
export function parseUgandaLocalTime(value: string): Date {
  const trimmed = value.trim();
  const amPmMatch = /^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);
  if (amPmMatch) {
    const [, datePart, rawHour, minute, meridiem] = amPmMatch;
    let hour = Number(rawHour);
    const isPm = meridiem.toUpperCase() === "PM";
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    const hh = String(hour).padStart(2, "0");
    return new Date(`${datePart}T${hh}:${minute}:00${UGANDA_UTC_OFFSET}`);
  }
  const normalized = trimmed.replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(`${normalized}${UGANDA_UTC_OFFSET}`);
}

/** Parse API timestamps: ISO instants or Uganda-local datetime strings. */
export function parseWeatherTimestamp(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date(Number.NaN);

  const normalized = trimmed.replace(" ", "T");
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }

  return parseUgandaLocalTime(trimmed);
}

export function formatUgandaDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
  language: SupportedLocale = "en",
): string | null {
  const date = typeof value === "string" ? parseWeatherTimestamp(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  if (language === "lg") {
    const p = kampalaParts(date);
    const weekdayIndex = new Date(Date.UTC(p.year, p.monthIndex, p.day)).getUTCDay();
    const hasWeekday = Boolean(options.weekday) || options.dateStyle === "full";
    const hasExplicitDate = Boolean(options.day || options.month || options.year);
    const hasDate = hasExplicitDate || Boolean(options.dateStyle);
    const hasTime = Boolean(
      options.hour || options.minute || options.second || options.timeStyle,
    );
    const parts: string[] = [];
    if (hasWeekday) {
      const weekdayName =
        options.weekday === "short" || options.weekday === "narrow"
          ? LUGANDA_WEEKDAYS_SHORT[weekdayIndex]
          : LUGANDA_WEEKDAYS[weekdayIndex];
      if (weekdayName) parts.push(weekdayName);
    }
    if (hasDate) {
      const monthName = LUGANDA_MONTHS_SHORT[p.monthIndex] ?? "";
      if (
        (options.day && options.month && options.year) ||
        (!hasExplicitDate && options.dateStyle)
      ) {
        parts.push(`${p.day} ${monthName} ${p.year}`);
      } else if (options.day && options.month) {
        parts.push(`${p.day} ${monthName}`);
      } else if (options.month && options.year) {
        parts.push(`${monthName} ${p.year}`);
      } else if (options.month) {
        parts.push(monthName);
      } else if (options.day) {
        parts.push(`${p.day}`);
      } else if (options.year) {
        parts.push(`${p.year}`);
      }
    }
    if (hasTime) {
      parts.push(
        formatLugandaClockParts(
          p.hour24,
          p.minute,
          "medium",
          options.second || options.timeStyle === "medium" || options.timeStyle === "long" || options.timeStyle === "full"
            ? p.second
            : undefined,
        ),
      );
    }
    if (parts.length > 0) {
      return parts.join(", ");
    }
    const monthName = LUGANDA_MONTHS_SHORT[p.monthIndex] ?? "";
    return `${p.day} ${monthName} ${p.year}, ${formatLugandaClockParts(
      p.hour24,
      p.minute,
      "medium",
    )}`;
  }

  return date.toLocaleString("en-UG", {
    timeZone: UGANDA_TIMEZONE,
    ...options,
  });
}

export function formatUgandaTimeLabel(
  value: string,
  language: SupportedLocale = "en",
): string {
  const date = parseUgandaLocalTime(value);
  if (language === "lg") {
    if (Number.isNaN(date.getTime())) return value;
    const p = kampalaParts(date);
    return formatLugandaClockParts(p.hour24, p.minute, "compact");
  }
  return date.toLocaleTimeString("en-UG", {
    hour: "numeric",
    hour12: true,
    timeZone: UGANDA_TIMEZONE,
  });
}

export function ugandaNowFromLocalTime(localTime: string): number {
  return parseUgandaLocalTime(localTime).getTime();
}

export function formatUgandaClock(
  date: Date,
  withSeconds = false,
  language: SupportedLocale = "en",
): string {
  if (language === "lg") {
    const p = kampalaParts(date);
    return formatLugandaClockParts(
      p.hour24,
      p.minute,
      "medium",
      withSeconds ? p.second : undefined,
    );
  }
  return date.toLocaleTimeString("en-UG", {
    hour: "numeric",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: true,
    timeZone: UGANDA_TIMEZONE,
  });
}

/**
 * The calendar date in Kampala for a given instant, as `YYYY-MM-DD`.
 *
 * `toISOString().slice(0, 10)` is the tempting version and it is wrong for
 * anywhere east of Greenwich. Uganda is UTC+3, so local midnight through
 * 03:00 still falls on the previous UTC day: a provider that reports a day
 * as the instant of its local midnight ends up with every date shifted one
 * day back.
 */
export function ugandaCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UGANDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** WeatherAPI-style local timestamp for demo / fallbacks. */
export function currentUgandaLocalTimeString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UGANDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Current time in Africa/Kampala expressed as elapsed minutes since midnight (0..1439). */
export function nowInUgandaMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UGANDA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const hour = get("hour") % 24;
  const minute = get("minute");
  return hour * 60 + minute;
}

