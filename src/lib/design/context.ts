import type { WeatherBundle } from "@/types/weather";

export function hoursAheadSummary(weather: WeatherBundle) {
  const gusts = weather.wind.gustKph;
  const windNote =
    gusts >= 35 ? ` Strong winds up to ${Math.round(gusts)} km/h.` : "";

  const upcomingRain = weather.hourly
    .filter((hour) => hour.kind === "hour")
    .slice(0, 12)
    .filter((hour) => (hour.rainChance ?? 0) >= 50);
  if (upcomingRain.length >= 3) {
    return `Rain likely for the next few hours.${windNote}`;
  }
  if (upcomingRain.length >= 1) {
    const peak = Math.max(...upcomingRain.map((hour) => hour.rainChance ?? 0));
    return `Rain possible later, up to ${peak}%.${windNote}`;
  }

  if (weather.condition.theme === "cloudy" || weather.condition.theme === "partly_cloudy") {
    return `Clouds for the rest of the day.${windNote}`;
  }
  if (weather.condition.theme === "rain" || weather.precipitation.mm > 0) {
    return `Rain expected through the day.${windNote}`;
  }
  if (weather.condition.theme === "thunder") {
    return `Storms possible. Watch for lightning and heavy rain.${windNote}`;
  }
  if (weather.condition.theme === "fog") {
    return `Fog and low visibility through the morning.${windNote}`;
  }
  if (weather.condition.theme === "clear") {
    return `Clear skies for the hours ahead.${windNote}`;
  }

  const tomorrow = weather.dailyForecast[1];
  if (tomorrow && tomorrow.high > weather.temperature.celsius + 2) {
    return `Warmth builds toward tomorrow. Highs may reach ${tomorrow.high}°.${windNote}`;
  }

  return `${weather.condition.text} for the next hours.${windNote}`;
}
