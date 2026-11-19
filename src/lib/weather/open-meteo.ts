import type { District } from "@/types/weather";
import { openMeteoCoordsForDistrict } from "./location-query";
import {
  currentUgandaLocalTimeString,
  formatUgandaTimeLabel,
  parseUgandaLocalTime,
  ugandaNowFromLocalTime,
} from "@/lib/time/uganda";
import {
  aqiFromPm25,
  degreesToCompass,
  formatSunTime,
  moonInfo,
  themeFromWmo,
  visibilityKmFromWmo,
  weatherApiIconUrl,
  wmoLabel,
  wmoToWeatherApiCode,
} from "./wmo";

interface OpenMeteoForecastResponse {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    dew_point_2m: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    is_day: number[];
    uv_index: number[];
    relative_humidity_2m: number[];
    surface_pressure: number[];
    wind_speed_10m: number[];
    apparent_temperature: number[];
    dew_point_2m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
  };
}

interface OpenMeteoAirQualityResponse {
  current?: {
    pm2_5?: number;
    us_aqi?: number;
  };
}

const OPEN_METEO_USER_AGENT =
  "uganda-weather/1.0 (https://uganda-weather.com; contact@uganda-weather.com)";

async function fetchOpenMeteoForecast(
  district: District,
  signal: AbortSignal,
): Promise<OpenMeteoForecastResponse> {
  const coords = openMeteoCoordsForDistrict(district);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lon));
  url.searchParams.set("timezone", "Africa/Kampala");
  url.searchParams.set("forecast_days", "10");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "dew_point_2m",
      "is_day",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code,is_day,uv_index,relative_humidity_2m,surface_pressure,wind_speed_10m,apparent_temperature,dew_point_2m,wind_gusts_10m,wind_direction_10m",
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "uv_index_max",
      "precipitation_sum",
      "precipitation_probability_max",
    ].join(","),
  );

  const response = await fetch(url, {
    headers: { "User-Agent": OPEN_METEO_USER_AGENT },
    signal,
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }

  return response.json() as Promise<OpenMeteoForecastResponse>;
}

async function fetchOpenMeteoAirQuality(
  district: District,
  signal: AbortSignal,
): Promise<OpenMeteoAirQualityResponse | null> {
  const coords = openMeteoCoordsForDistrict(district);
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lon));
  url.searchParams.set("timezone", "Africa/Kampala");
  url.searchParams.set("current", "pm2_5,us_aqi");

  const response = await fetch(url, {
    headers: { "User-Agent": OPEN_METEO_USER_AGENT },
    signal,
    next: { revalidate: 0 },
  });
  if (!response.ok) return null;
  return response.json() as Promise<OpenMeteoAirQualityResponse>;
}

export async function fetchOpenMeteoBundle(
  district: District,
  signal: AbortSignal,
  options?: { asFallback?: boolean },
) {
  const [payload, airPayload] = await Promise.all([
    fetchOpenMeteoForecast(district, signal),
    fetchOpenMeteoAirQuality(district, signal).catch(() => null),
  ]);

  const current = payload.current;
  const isDay = current.is_day === 1;
  const apiCode = wmoToWeatherApiCode(current.weather_code);
  const currentTheme = themeFromWmo(current.weather_code, isDay);
  const currentIcon = weatherApiIconUrl(apiCode, isDay);
  const rawLocalTime = current.time.replace("T", " ");
  const rawNowMs = ugandaNowFromLocalTime(rawLocalTime);
  const realNowMs = Date.now();
  // Open-Meteo `current.time` updates on 15-minute model intervals and can lag
  // behind the real wall clock across an hour boundary (for example reporting
  // 01:45 when the real clock is 02:00:52). Advance `nowMs` to the real clock
  // when within 2 hours so the current hour is never duplicated right after "Now".
  const nowMs =
    Math.abs(realNowMs - rawNowMs) < 2 * 3600_000
      ? Math.max(rawNowMs, realNowMs)
      : rawNowMs;
  const localTime =
    nowMs > rawNowMs ? currentUgandaLocalTimeString(new Date(nowMs)) : rawLocalTime;

  let currentHourIndex = 0;
  for (let i = 0; i < payload.hourly.time.length; i += 1) {
    const hourMs = parseUgandaLocalTime(payload.hourly.time[i].replace("T", " ")).getTime();
    if (hourMs > nowMs) break;
    currentHourIndex = i;
  }

  const hourly: import("@/types/weather").HourlyPoint[] = [
    {
      time: localTime,
      label: "Now",
      temp: Math.round(current.temperature_2m),
      icon: currentIcon,
      theme: currentTheme,
      isDay,
      kind: "hour",
      rainChance: Math.round(payload.hourly.precipitation_probability[currentHourIndex] ?? 0),
      uvIndex: Math.round(payload.hourly.uv_index[currentHourIndex] ?? 0),
      windSpeedKph: Math.round(
        payload.hourly.wind_speed_10m[currentHourIndex] ?? current.wind_speed_10m,
      ),
      humidity: Math.round(
        payload.hourly.relative_humidity_2m[currentHourIndex] ?? current.relative_humidity_2m,
      ),
      pressureMb: Math.round(
        payload.hourly.surface_pressure[currentHourIndex] ?? current.surface_pressure,
      ),
      visibilityKm: visibilityKmFromWmo(
        payload.hourly.weather_code[currentHourIndex] ?? current.weather_code,
      ),
      feelsLike: Math.round(
        payload.hourly.apparent_temperature[currentHourIndex] ?? current.apparent_temperature,
      ),
      dewPointC: Math.round(
        payload.hourly.dew_point_2m[currentHourIndex] ?? current.dew_point_2m,
      ),
      gustKph: Math.round(
        payload.hourly.wind_gusts_10m[currentHourIndex] ?? current.wind_gusts_10m,
      ),
      windDegree: Math.round(
        payload.hourly.wind_direction_10m[currentHourIndex] ?? current.wind_direction_10m,
      ),
    },
  ];

  for (let i = 0; i < payload.hourly.time.length; i += 1) {
    const hourTime = payload.hourly.time[i];
    const hourMs = parseUgandaLocalTime(hourTime).getTime();
    if (hourMs <= nowMs) continue;
    if (hourly.length >= 24) break;

    const hourIsDay = payload.hourly.is_day[i] === 1;
    const hourWmo = payload.hourly.weather_code[i];
    const hourCode = wmoToWeatherApiCode(hourWmo);

    hourly.push({
      time: hourTime.replace("T", " "),
      label: formatUgandaTimeLabel(hourTime),
      temp: Math.round(payload.hourly.temperature_2m[i]),
      icon: weatherApiIconUrl(hourCode, hourIsDay),
      theme: themeFromWmo(hourWmo, hourIsDay),
      isDay: hourIsDay,
      kind: "hour",
      rainChance: Math.round(payload.hourly.precipitation_probability[i] ?? 0),
      uvIndex: Math.round(payload.hourly.uv_index[i] ?? 0),
      windSpeedKph: Math.round(payload.hourly.wind_speed_10m[i] ?? 0),
      humidity: Math.round(payload.hourly.relative_humidity_2m[i] ?? 0),
      pressureMb: Math.round(payload.hourly.surface_pressure[i] ?? 0),
      visibilityKm: visibilityKmFromWmo(hourWmo),
      feelsLike: Math.round(payload.hourly.apparent_temperature[i] ?? 0),
      dewPointC: Math.round(payload.hourly.dew_point_2m[i] ?? 0),
      gustKph: Math.round(payload.hourly.wind_gusts_10m[i] ?? 0),
      windDegree: Math.round(payload.hourly.wind_direction_10m[i] ?? 0),
    });
  }

  for (let dayIdx = 0; dayIdx < Math.min(2, payload.daily.time.length); dayIdx += 1) {
    const daySunrise = payload.daily.sunrise?.[dayIdx];
    if (daySunrise) {
      const sunriseMs = parseUgandaLocalTime(daySunrise.replace("T", " ")).getTime();
      const sunriseIndex = hourly.findIndex(
        (point) => point.kind === "hour" && parseUgandaLocalTime(point.time).getTime() > sunriseMs,
      );
      if (sunriseMs > nowMs && sunriseIndex > 0) {
        hourly.splice(sunriseIndex, 0, {
          time: daySunrise.replace("T", " "),
          label: formatSunTime(daySunrise),
          temp: 0,
          icon: "",
          kind: "sunrise",
        });
      }
    }

    const daySunset = payload.daily.sunset?.[dayIdx];
    if (daySunset) {
      const sunsetMs = parseUgandaLocalTime(daySunset.replace("T", " ")).getTime();
      const sunsetIndex = hourly.findIndex(
        (point) => point.kind === "hour" && parseUgandaLocalTime(point.time).getTime() > sunsetMs,
      );
      if (sunsetMs > nowMs && sunsetIndex > 0) {
        hourly.splice(sunsetIndex, 0, {
          time: daySunset.replace("T", " "),
          label: formatSunTime(daySunset),
          temp: 0,
          icon: "",
          kind: "sunset",
        });
      }
    }
  }

  const dailyForecast = payload.daily.time.map((date, index) => {
    const isToday = index === 0;
    const dayWmo = isToday ? current.weather_code : payload.daily.weather_code[index];
    const dayCode = wmoToWeatherApiCode(dayWmo);
    const dayIsDay = isToday ? isDay : true;

    const hours: import("@/types/weather").HourlyPoint[] = [];
    for (let i = 0; i < payload.hourly.time.length; i += 1) {
      if (!payload.hourly.time[i].startsWith(date)) continue;
      const hourIsDay = payload.hourly.is_day[i] === 1;
      const hourWmo = payload.hourly.weather_code[i];
      const hourCode = wmoToWeatherApiCode(hourWmo);
      hours.push({
        time: payload.hourly.time[i].replace("T", " "),
        label: formatUgandaTimeLabel(payload.hourly.time[i]),
        temp: Math.round(payload.hourly.temperature_2m[i]),
        icon: weatherApiIconUrl(hourCode, hourIsDay),
        theme: themeFromWmo(hourWmo, hourIsDay),
        isDay: hourIsDay,
        kind: "hour",
        rainChance: Math.round(payload.hourly.precipitation_probability[i] ?? 0),
        uvIndex: Math.round(payload.hourly.uv_index[i] ?? 0),
        windSpeedKph: Math.round(payload.hourly.wind_speed_10m[i] ?? 0),
        humidity: Math.round(payload.hourly.relative_humidity_2m[i] ?? 0),
        pressureMb: Math.round(payload.hourly.surface_pressure[i] ?? 0),
        visibilityKm: visibilityKmFromWmo(hourWmo),
        feelsLike: Math.round(payload.hourly.apparent_temperature[i] ?? 0),
        dewPointC: Math.round(payload.hourly.dew_point_2m[i] ?? 0),
        gustKph: Math.round(payload.hourly.wind_gusts_10m[i] ?? 0),
        windDegree: Math.round(payload.hourly.wind_direction_10m[i] ?? 0),
      });
    }

    return {
      day: isToday
        ? "Today"
        : new Date(`${date}T12:00:00+03:00`).toLocaleDateString("en-UG", {
            weekday: "short",
            timeZone: "Africa/Kampala",
          }),
      date,
      high: Math.round(payload.daily.temperature_2m_max[index]),
      low: Math.round(payload.daily.temperature_2m_min[index]),
      icon: isToday ? currentIcon : weatherApiIconUrl(dayCode, true),
      theme: themeFromWmo(dayWmo, dayIsDay),
      isToday,
      rainChance: Math.round(payload.daily.precipitation_probability_max[index] ?? 0),
      hours,
    };
  });

  const moon = moonInfo(parseUgandaLocalTime(localTime));
  const pm25 = airPayload?.current?.pm2_5;
  const air = aqiFromPm25(pm25);

  // The UV widget presents this as the live reading ("Use shade during
  // the brightest hours"), so it must track the current hour, not the
  // day's peak. `currentHourIndex` was resolved above against `nowMs`.
  const currentUvIndex = Math.round(
    payload.hourly.uv_index[currentHourIndex] ?? payload.daily.uv_index_max[0] ?? 0,
  );

  return {
    district,
    isDay,
    localTime,
    timezone: payload.timezone || "Africa/Kampala",
    temperature: {
      celsius: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
    },
    condition: {
      code: apiCode,
      text: wmoLabel(current.weather_code, isDay),
      icon: currentIcon,
      theme: currentTheme,
    },
    wind: {
      speedKph: Math.round(current.wind_speed_10m),
      gustKph: Math.round(current.wind_gusts_10m),
      direction: degreesToCompass(current.wind_direction_10m),
      degree: Math.round(current.wind_direction_10m),
    },
    humidity: Math.round(current.relative_humidity_2m),
    dewPointC: Math.round(current.dew_point_2m),
    uvIndex: currentUvIndex,
    visibilityKm: visibilityKmFromWmo(current.weather_code),
    pressureMb: Math.round(current.surface_pressure),
    precipitation: {
      mm: current.precipitation,
      chance: Math.round(payload.daily.precipitation_probability_max[0] ?? 0),
    },
    daily: {
      high: Math.round(payload.daily.temperature_2m_max[0]),
      low: Math.round(payload.daily.temperature_2m_min[0]),
    },
    hourly,
    dailyForecast,
    astronomy: {
      sunrise: formatSunTime(payload.daily.sunrise[0]),
      sunset: formatSunTime(payload.daily.sunset[0]),
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
    },
    airQuality: {
      aqi: air.aqi,
      category: air.category,
      advice:
        district.slug === "kampala"
          ? `Air quality is similar to recent days in Kampala. ${air.advice}`
          : air.advice,
      pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : undefined,
    },
    alerts: [],
    updatedAt: parseUgandaLocalTime(localTime).toISOString(),
    source: options?.asFallback ? "open-meteo.com/fallback" : "open-meteo.com",
    stale: false,
  };
}
