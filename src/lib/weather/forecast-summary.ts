import { formatHighLow } from "./copy";
import type { DailyPoint, WeatherBundle } from "@/types/weather";

const RAIN_THRESHOLD = 40;

export function rainLikelyDays(forecast: DailyPoint[]) {
  return forecast.filter((day) => (day.rainChance ?? 0) >= RAIN_THRESHOLD);
}

export function forecastWeekSummary(weather: WeatherBundle) {
  const days = weather.dailyForecast;
  if (days.length === 0) {
    return `Extended outlook for ${weather.district.name}.`;
  }

  const rainDays = rainLikelyDays(days);
  if (rainDays.length >= 3) {
    return `${rainDays.length} days may bring rain this week. Plan outdoor work during drier hours.`;
  }

  if (rainDays.length === 2) {
    return `Rain possible ${rainDays[0].day} and ${rainDays[1].day}.`;
  }

  if (rainDays.length === 1) {
    const dryDays = days.length - 1;
    return dryDays > 1
      ? `Rain possible ${rainDays[0].day}. Mostly dry otherwise.`
      : `Rain possible ${rainDays[0].day}.`;
  }

  const highs = days.map((day) => day.high);
  const lows = days.map((day) => day.low);
  const warmest = Math.max(...highs);
  const coolest = Math.min(...lows);

  if (warmest - coolest >= 10) {
    return `Temperatures swing from ${coolest}° to ${warmest}° over the next ${days.length} days.`;
  }

  return `A steady stretch ahead. Highs mostly ${Math.min(...highs)}° to ${warmest}°.`;
}

export function moduleForecastSubtitle(weather: WeatherBundle) {
  const today = weather.dailyForecast[0];
  const nextRain = weather.dailyForecast.find(
    (day, index) => index > 0 && (day.rainChance ?? 0) >= 50,
  );

  if (nextRain?.rainChance) {
    return `${nextRain.day}, ${nextRain.rainChance}% rain`;
  }

  if (today?.rainChance && today.rainChance >= 30) {
    return `Today, ${today.rainChance}% rain`;
  }

  return formatHighLow(weather.daily.high, weather.daily.low);
}

export function formatRainDayList(days: DailyPoint[]) {
  if (days.length === 0) return null;
  if (days.length === 1) return `${days[0].day} (${days[0].rainChance}%)`;
  if (days.length === 2) {
    return `${days[0].day} (${days[0].rainChance}%) and ${days[1].day} (${days[1].rainChance}%)`;
  }
  return `${days.length} days with rain likely`;
}
