"use client";

import { DistrictLocalClock } from "@/components/weather/DistrictLocalClock";
import { glassPanel } from "@/lib/design/brand-ui";
import { useTranslation } from "@/lib/i18n";
import {
  formatWeatherUpdatedAt,
  getWeatherProviderInfo,
  weatherSourceLabel,
  weatherStatusMessage,
} from "@/lib/weather/source";
import type { WeatherBundle } from "@/types/weather";

export function WeatherDataStatus({
  weather,
  metaStale = false,
  compact = false,
  className = "",
}: {
  weather: WeatherBundle;
  metaStale?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const info = getWeatherProviderInfo(weather.source, uiLanguage);
  const stale = metaStale || weather.stale;
  const message = weatherStatusMessage(weather, metaStale, uiLanguage);

  if (compact) {
    const updated = formatWeatherUpdatedAt(weather.updatedAt, uiLanguage);
    const sourceText = dict.common.dataSourceLabel.replace(
      "{source}",
      weatherSourceLabel(weather.source, uiLanguage),
    );
    const updatedText = updated
      ? ` · ${dict.common.updatedAtLabel.replace("{time}", updated)}`
      : "";
    return (
      <p className={`text-on-sky text-[12px] leading-relaxed text-white/90 ${className}`}>
        {weather.localTime && (
          <DistrictLocalClock localTime={weather.localTime} compact className="tabular-nums font-medium text-white/92" />
        )}
        <span className="mt-1 block text-white/90">
          {stale ? message : `${sourceText}${updatedText}`}
        </span>
      </p>
    );
  }

  return (
    <div className={`mx-auto max-w-lg px-4 py-3 text-center ${glassPanel} ${className}`}>
      <p
        className={
          uiLanguage === "lg"
            ? "text-[12px] font-semibold text-white/75"
            : "text-[12px] font-semibold uppercase tracking-[0.14rem] text-white/70"
        }
      >
        {weatherSourceLabel(weather.source, uiLanguage)}
        {stale && <span className="text-white/75">, {dict.common.saved}</span>}
      </p>
      {weather.localTime && (
        <p className="mt-2 text-[22px] font-light tabular-nums tracking-[-0.02rem] text-white">
          <DistrictLocalClock localTime={weather.localTime} compact />
          <span className="ml-2 text-[12px] font-normal normal-case tracking-normal text-white/75">
            {dict.common.localTime}
          </span>
        </p>
      )}
      <p className="mt-2 text-[13px] leading-relaxed text-white/75">{message}</p>
      {info.provider === "demo" && (
        <p className="mt-2 text-[12px] text-white/75">
          {dict.common.trySampleDistricts}
        </p>
      )}
    </div>
  );
}
