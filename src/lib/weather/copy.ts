const SMALL_WORDS = new Set(["of", "and", "the", "in", "at", "on", "for", "to", "with"]);

/** Exact WeatherAPI / provider strings mapped to our own short condition names. */
const CONDITION_BY_PHRASE: Record<string, string> = {
  clear: "Clear",
  sunny: "Sunny",
  "mainly clear": "Mostly Clear",
  "partly cloudy": "Partly Cloudy",
  cloudy: "Cloudy",
  overcast: "Cloudy",
  "mostly cloudy": "Mostly Cloudy",
  mist: "Fog",
  fog: "Fog",
  "freezing fog": "Fog",
  haze: "Hazy",
  "smoky haze": "Hazy",
  smoke: "Hazy",
  "light drizzle": "Light Drizzle",
  drizzle: "Drizzle",
  "heavy drizzle": "Heavy Drizzle",
  "light rain": "Light Rain",
  "moderate rain": "Rain",
  rain: "Rain",
  "heavy rain": "Heavy Rain",
  "light rain shower": "Light Rain",
  "moderate or heavy rain shower": "Rain Showers",
  "patchy rain possible": "Chance of Rain",
  "patchy rain nearby": "Chance of Rain",
  "patchy light drizzle": "Light Drizzle",
  "patchy light rain": "Light Rain",
  "patchy rain": "Rain Showers",
  "rain shower": "Rain Showers",
  "light rain showers": "Rain Showers",
  "moderate or heavy rain showers": "Rain Showers",
  "heavy rain shower": "Heavy Rain",
  "thundery outbreaks possible": "Possible Thunderstorms",
  "thundery outbreaks in nearby": "Possible Thunderstorms",
  thunderstorm: "Thunderstorms",
  "thunderstorm with hail": "Thunderstorms",
  "thunderstorm with heavy hail": "Thunderstorms",
  "depositing rime fog": "Fog",
  // No "blizzard"/"blowing snow" entries: none of Uganda's 152 districts
  // are anywhere near freezing (even Kabale's highland mornings stay well
  // above it), so snow conditions are structurally impossible for any
  // district this app actually forecasts for. Leftover from a generic
  // global condition-name template that was never adapted for Uganda's
  // climate — if a provider ever sent one of these strings anyway (a
  // data anomaly, not a real Uganda forecast), it now falls through to
  // the generic title-case fallback below rather than confidently
  // mislabeling it "Snow".
};

function toConditionTitleCase(text: string) {
  return text
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function formatCondition(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Partly Cloudy";

  const key = trimmed.toLowerCase();
  if (CONDITION_BY_PHRASE[key]) return CONDITION_BY_PHRASE[key];

  if (/smok(y|e)|haze/.test(key)) return "Hazy";
  if (/\bmist\b|\bfog\b/.test(key)) return "Fog";
  if (/thunder/.test(key)) return key.includes("possible") ? "Possible Thunderstorms" : "Thunderstorms";
  if (/hail/.test(key) && /rain|shower/.test(key)) return "Rain Showers";
  if (/shower/.test(key)) return key.includes("heavy") ? "Heavy Rain" : "Rain Showers";
  if (/drizzle/.test(key)) return key.includes("light") ? "Light Drizzle" : "Drizzle";
  if (/\brain\b/.test(key)) return key.includes("light") ? "Light Rain" : key.includes("heavy") ? "Heavy Rain" : "Rain";
  if (/patchy/.test(key) && /rain/.test(key)) return "Chance of Rain";

  return toConditionTitleCase(trimmed);
}

export function formatHighLow(high: number, low: number) {
  return `H:${high}°  L:${low}°`;
}

export function formatFeelsLike(feelsLike: number) {
  return `Feels Like ${feelsLike}°`;
}

export function formatMonthRange(start: string, end: string) {
  return `${start} to ${end}`;
}
