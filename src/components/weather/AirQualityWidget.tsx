"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScaleBar, WidgetTile } from "@/components/glass/WidgetTile";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import { weatherTargetQueryString } from "@/lib/weather/location-query";
import type { District, WeatherBundle } from "@/types/weather";

export interface PollutantBreakdown {
  co: number;
  no2: number;
  o3: number;
  pm10: number;
  pm25: number;
}

export const POLLUTANT_LABELS: Array<{ key: keyof PollutantBreakdown; label: string; unit: string }> = [
  { key: "pm25", label: "PM2.5", unit: "µg/m³" },
  { key: "pm10", label: "PM10", unit: "µg/m³" },
  { key: "o3", label: "Ozone (O3)", unit: "µg/m³" },
  { key: "no2", label: "Nitrogen dioxide (NO2)", unit: "µg/m³" },
  { key: "co", label: "Carbon monoxide (CO)", unit: "µg/m³" },
];

export async function fetchAirQualityPollutants(
  target: string | District,
): Promise<PollutantBreakdown | null> {
  try {
    const query =
      typeof target === "string"
        ? `district=${encodeURIComponent(target)}`
        : weatherTargetQueryString(target);
    const response = await fetch(`/api/v1/air-quality?${query}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data?.pollutants ?? null;
  } catch {
    return null;
  }
}

function AirQualityDetailContent({
  weather,
  pollutants,
}: {
  weather: WeatherBundle;
  pollutants: PollutantBreakdown | null | undefined;
}) {
  const { dict, uiLanguage } = useTranslation();
  const aq = dict.sheets.airQuality;
  const { aqi, category, advice, pm25 } = weather.airQuality;
  const localizedCategory =
    uiLanguage === "lg"
      ? aqi <= 50
        ? dict.metrics.aqiGood
        : aqi <= 100
          ? dict.metrics.aqiModerate
          : aqi <= 150
            ? dict.metrics.aqiUnhealthySensitive
            : dict.metrics.aqiUnhealthy
      : category;
  const advisoryTemplate =
    aqi <= 50
      ? aq.advisoryGood
      : aqi <= 100
        ? aq.advisoryModerate
        : aqi <= 150
          ? aq.advisorySensitive
          : aq.advisoryUnhealthy;
  const localizedAdvice =
    uiLanguage === "lg"
      ? formatDistrictPhrase(advisoryTemplate, weather.district.name, dict, uiLanguage)
      : advice;

  if (uiLanguage !== "lg") {
    return (
      <>
        <p className="text-[26px] font-medium leading-tight text-white">{category}</p>
        <p className="mt-1 text-[13px] text-white/50">AQI {aqi} of 150+</p>
        <ScaleBar value={aqi} max={150} />

        <p className="mt-4">{advice}</p>

        <div className="mt-4 pt-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50">
            Health guidance
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
            The air is safe for most people right now. People with asthma, young children, and older
            adults are more sensitive to dust and smoke and should take care if they feel discomfort.
          </p>
        </div>

        <div className="mt-4 pt-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50">
            Primary pollutant
          </p>
          <p className="mt-1.5 text-[15px] font-medium text-white">
            PM2.5{pm25 != null ? ` · ${pm25} µg/m³` : ""}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-white/72">
            Tiny dust and smoke particles in the air, mostly from roads, traffic, and burning.
          </p>
        </div>

        {pollutants && (
          <div className="mt-4 space-y-1.5 pt-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50">
              Pollutant breakdown
            </p>
            {POLLUTANT_LABELS.map(({ key, label, unit }) => (
              <div key={key} className="flex items-center justify-between text-[13px]">
                <span className="text-white/70">{label}</span>
                <span className="text-white">
                  {pollutants[key]} {unit}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[13px] leading-relaxed text-white/50">
          Dust and smoke from burning are common contributors to poor air days in Uganda,
          especially during the dry season and near busy roads. NEMA (Uganda&apos;s National
          Environment Management Authority) has been expanding air quality monitoring across the
          country.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[26px] font-medium leading-tight text-white">{localizedCategory}</p>
      <p className="mt-1 text-[13px] text-white/50">
        {aq.aqiScaleOf.replace("{value}", String(aqi))}
      </p>
      <ScaleBar value={aqi} max={150} />

      {uiLanguage !== "lg" && <p className="mt-4">{localizedAdvice}</p>}

      <div className="mt-4 pt-3">
        <p className="text-[13px] font-semibold text-white/60">
          {aq.healthGuidance}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {formatDistrictPhrase(advisoryTemplate, weather.district.name, dict, uiLanguage)}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[13px] font-semibold text-white/60">
          {aq.primaryPollutantTitle}
        </p>
        <p className="mt-1.5 text-[15px] font-medium text-white">
          PM2.5{pm25 != null ? ` · ${uiLanguage === "lg" ? `µg/m³ ${pm25}` : `${pm25} µg/m³`}` : ""}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-white/72">
          {aq.primaryPollutantDesc}
        </p>
      </div>

      {pollutants && (
        <div className="mt-4 space-y-1.5 pt-3">
          <p className="text-[13px] font-semibold text-white/60">
            {aq.pollutantBreakdownTitle}
          </p>
          {POLLUTANT_LABELS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between text-[13px]">
              <span className="text-white/70">{dict.metrics.pollutants[key] ?? label}</span>
              <span className="text-white">
                {uiLanguage === "lg" ? `${unit} ${pollutants[key]}` : `${pollutants[key]} ${unit}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{aq.aboutTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {aq.aboutBody}
        </p>
      </div>
    </>
  );
}

export function airQualityDetail(weather: WeatherBundle, pollutants: PollutantBreakdown | null | undefined) {
  return <AirQualityDetailContent weather={weather} pollutants={pollutants} />;
}

export function AirQualityWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const [wantsPollutants, setWantsPollutants] = useState(false);
  const targetKey = weather.district.isPlace
    ? weatherTargetQueryString(weather.district)
    : weather.district.slug;
  const { data: pollutants } = useQuery({
    queryKey: ["air-quality-pollutants", targetKey],
    queryFn: () => fetchAirQualityPollutants(weather.district),
    enabled: wantsPollutants,
    staleTime: 25 * 60 * 1000,
  });

  const category =
    uiLanguage === "lg"
      ? weather.airQuality.aqi <= 50
        ? dict.metrics.aqiGood
        : weather.airQuality.aqi <= 100
          ? dict.metrics.aqiModerate
          : weather.airQuality.aqi <= 150
            ? dict.metrics.aqiUnhealthySensitive
            : dict.metrics.aqiUnhealthy
      : weather.airQuality.category;

  const footer =
    uiLanguage === "lg"
      ? weather.airQuality.aqi <= 50
        ? dict.metrics.aqiAdviceGood
        : formatDistrictPhrase(
            weather.airQuality.aqi <= 100
              ? dict.sheets.airQuality.advisoryModerate
              : weather.airQuality.aqi <= 150
                ? dict.sheets.airQuality.advisorySensitive
                : dict.sheets.airQuality.advisoryUnhealthy,
            weather.district.name,
            dict,
            uiLanguage,
          )
      : weather.airQuality.advice;

  return (
    <WidgetTile
      title={dict.metrics.airQuality}
      footer={footer}
      theme={weather.condition.theme}
      detail={airQualityDetail(weather, pollutants)}
      onExpand={() => setWantsPollutants(true)}
    >
      <p
        className={`font-medium leading-tight text-white ${
          uiLanguage === "lg" ? "text-[22px]" : "text-[32px]"
        }`}
      >
        {category}
      </p>
      <ScaleBar value={weather.airQuality.aqi} max={150} />
    </WidgetTile>
  );
}
