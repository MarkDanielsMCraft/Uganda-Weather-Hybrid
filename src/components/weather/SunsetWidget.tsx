"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { clockLabelToMinutes, SunArc, useUgandaNowMinutes } from "@/components/weather/SunArc";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import { formatClockLabelForLanguage, formatDurationForLanguage } from "@/lib/time/uganda";
import type { WeatherBundle } from "@/types/weather";

function SunsetDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const s = dict.sheets.sunset;
  const { sunrise, sunset } = weather.astronomy;
  const sunriseMin = clockLabelToMinutes(sunrise);
  const sunsetMin = clockLabelToMinutes(sunset);
  const validWindow = sunriseMin != null && sunsetMin != null && sunsetMin > sunriseMin;
  const nowMin = useUgandaNowMinutes();
  const isDaytime = validWindow && nowMin != null && nowMin >= sunriseMin && nowMin <= sunsetMin;
  const headline =
    !validWindow || nowMin == null
      ? formatDistrictPhrase(s.defaultHeadline, weather.district.name, dict, uiLanguage)
      : isDaytime
        ? s.leftToday.replace("{time}", formatDurationForLanguage(sunsetMin - nowMin, uiLanguage))
        : nowMin < sunriseMin
          ? s.sunRisesIn.replace("{time}", formatDurationForLanguage(sunriseMin - nowMin, uiLanguage))
          : s.sunHasSet;

  const valueTextClass = isLuganda ? "mt-0.5 text-[13px] text-white" : "mt-0.5 text-[14px] text-white";

  return (
    <>
      <p className="text-[16px] text-white">{headline}</p>
      {validWindow && (
        <>
          <SunArc sunrise={sunrise} sunset={sunset} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
            <div>
              <p className="text-white/40">{s.sunrise}</p>
              <p className={valueTextClass}>
                {formatClockLabelForLanguage(sunrise, uiLanguage, "medium")}
              </p>
            </div>
            <div>
              <p className="text-white/40">{s.daylight}</p>
              <p className={valueTextClass}>
                {formatDurationForLanguage(sunsetMin - sunriseMin, uiLanguage)}
              </p>
            </div>
            <div>
              <p className="text-white/40">{s.sunset}</p>
              <p className={valueTextClass}>
                {formatClockLabelForLanguage(sunset, uiLanguage, "medium")}
              </p>
            </div>
          </div>
        </>
      )}
      <p className={isLuganda ? "mt-3 text-[13px] leading-relaxed text-white/60" : "mt-3"}>
        {s.equatorNote}
      </p>
    </>
  );
}

export function sunsetDetail(weather: WeatherBundle) {
  return <SunsetDetailContent weather={weather} />;
}

export function SunsetWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const formattedSunrise = formatClockLabelForLanguage(weather.astronomy.sunrise, uiLanguage, "medium");
  const formattedSunset = formatClockLabelForLanguage(weather.astronomy.sunset, uiLanguage, "medium");
  const sunsetSpaceIdx = formattedSunset.indexOf(" ");
  const sunsetClock = sunsetSpaceIdx > 0 ? formattedSunset.slice(0, sunsetSpaceIdx) : formattedSunset;
  const sunsetPeriod = sunsetSpaceIdx > 0 ? formattedSunset.slice(sunsetSpaceIdx + 1) : "";

  return (
    <WidgetTile
      title={dict.metrics.sunset}
      footer={`${dict.metrics.sunrise}: ${formattedSunrise}`}
      theme={weather.condition.theme}
      detail={sunsetDetail(weather)}
    >
      {isLuganda && sunsetPeriod ? (
        <div className="text-white">
          <p className="text-[28px] font-medium leading-none">{sunsetClock}</p>
          <p className="mt-1 text-[13px] font-normal leading-snug text-white/75">{sunsetPeriod}</p>
        </div>
      ) : (
        <p className="text-[34px] font-medium text-white">{formattedSunset}</p>
      )}
      <SunArc sunrise={weather.astronomy.sunrise} sunset={weather.astronomy.sunset} compact />
    </WidgetTile>
  );
}
