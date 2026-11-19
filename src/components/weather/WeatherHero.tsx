"use client";

import Link from "next/link";
import { WeatherDataStatus } from "@/components/weather/WeatherDataStatus";
import { DistrictLocalClock } from "@/components/weather/DistrictLocalClock";
import { formatHighLow } from "@/lib/weather/copy";
import { formatConditionLg, formatHighLowLg } from "@/lib/weather/copy-lg";
import { formatDistrictPhrase, useTranslation, type TranslationDictionary } from "@/lib/i18n";
import { useScrollCollapse } from "@/components/layout/ScrollCollapseContext";
import type { ApiMeta, WeatherBundle } from "@/types/weather";

function locationEyebrow(weather: WeatherBundle, dict: TranslationDictionary, override?: string) {
  if (override) return override;
  if (weather.district.name === "Your location") return dict.eyebrows.myLocation;
  if (weather.district.isPlace) return dict.eyebrows.localForecast;
  return dict.eyebrows.districtForecast;
}

export function WeatherHero({
  weather,
  meta,
  desktop = false,
  placeSubtitle,
  locationLabel,
  showProviderStatus = true,
}: {
  weather: WeatherBundle;
  meta?: ApiMeta;
  desktop?: boolean;
  placeSubtitle?: string;
  locationLabel?: string;
  showProviderStatus?: boolean;
}) {
  const { uiLanguage, dict } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const rawSubtitle = placeSubtitle ?? (weather.district.isPlace ? weather.district.placeLabel : undefined);
  const subtitle =
    isLuganda && rawSubtitle && /^near\s+/i.test(rawSubtitle)
      ? formatDistrictPhrase(
          dict.common.nearDistrict,
          rawSubtitle.replace(/^near\s+/i, ""),
          dict,
          uiLanguage,
        )
      : rawSubtitle;
  const displayDistrictName =
    weather.district.name === "Your location" ? dict.common.yourLocation : weather.district.name;
  const eyebrow = locationEyebrow(weather, dict, locationLabel);
  const conditionText = isLuganda ? formatConditionLg(weather.condition.text, weather.isDay) : weather.condition.text;
  const highLowText = isLuganda ? formatHighLowLg(weather.daily.high, weather.daily.low) : formatHighLow(weather.daily.high, weather.daily.low);
  const highLowNode = isLuganda ? (
    <>
      <span className="whitespace-nowrap">Waggulu: {weather.daily.high}°</span>
      {"  "}
      <span className="whitespace-nowrap">Wansi: {weather.daily.low}°</span>
    </>
  ) : (
    highLowText
  );
  const { progress } = useScrollCollapse();

  if (desktop) {
    return (
      <section className="relative px-2 pb-4 pt-6 text-center">
        <p
          className={
            isLuganda
              ? "text-on-sky text-[13px] font-medium text-white/95"
              : "text-on-sky text-[12px] font-semibold uppercase tracking-[0.16rem] text-white/95"
          }
        >
          {eyebrow}
        </p>
        <h1 className="text-on-sky-strong mt-2 block text-[34px] font-semibold tracking-[-0.02rem] text-white">
          <Link href="/search" className="block text-inherit">
            {displayDistrictName}
          </Link>
        </h1>
        {subtitle && (
          <p className="text-on-sky mt-1 text-[14px] font-medium text-white/92">{subtitle}</p>
        )}
        <DistrictLocalClock
          localTime={weather.localTime}
          districtName={displayDistrictName}
          className="text-on-sky mt-2 text-[15px] font-medium text-white/95"
        />
        <p className="text-on-sky-strong mt-2 font-extralight leading-none tracking-[-0.06rem] text-white text-[104px]">
          {weather.temperature.celsius}°
        </p>
        <p className="text-on-sky mt-1 text-[24px] font-medium text-white">{conditionText}</p>
        <p className="text-on-sky mt-2 text-[17px] font-medium text-white/95">
          {highLowNode}
        </p>
        {showProviderStatus && (
          <WeatherDataStatus
            weather={weather}
            metaStale={meta?.stale}
            className="mt-4"
          />
        )}
      </section>
    );
  }

  const heroTransformStyle = {
    opacity: Math.max(0, 1 - progress * 1.25),
    transform: `translate3d(0, -${(progress * 14).toFixed(1)}px, 0) scale(${(1 - progress * 0.08).toFixed(3)})`,
    willChange: progress > 0 && progress < 1 ? "transform, opacity" : "auto",
  };

  return (
    <section
      className="relative px-1 pb-2 pt-4 text-center"
      style={heroTransformStyle}
    >
      <p
        className={
          isLuganda
            ? "text-on-sky text-[13px] font-medium text-white/95 sm:text-[14px]"
            : "text-on-sky text-[13px] font-medium uppercase tracking-[0.14rem] text-white/95 sm:text-[14px]"
        }
      >
        {eyebrow}
      </p>
      <h1 className="text-on-sky-strong mt-1 block text-[32px] font-semibold tracking-[-0.03rem] text-white sm:text-[38px]">
        <Link href="/search" className="block text-inherit">
          {displayDistrictName}
        </Link>
      </h1>
      {subtitle && (
        <p className="text-on-sky mt-0.5 text-[13px] font-medium text-white/92 sm:text-[14px]">{subtitle}</p>
      )}
      <DistrictLocalClock
        districtName={displayDistrictName}
        className="text-on-sky mt-1 text-[14px] font-medium text-white/95"
      />
      <p className="text-on-sky-strong mt-2 font-extralight leading-none tracking-[-0.06rem] text-white text-[76px] sm:text-[92px]">
        {weather.temperature.celsius}°
      </p>
      <p className="text-on-sky mt-1 text-[20px] font-medium text-white sm:text-[22px]">{conditionText}</p>
      <p className="text-on-sky mt-1 text-[15px] font-medium text-white/95 sm:text-[17px]">
        {highLowNode}
      </p>
      {showProviderStatus && (
        <WeatherDataStatus
          weather={weather}
          metaStale={meta?.stale}
          className="mt-3"
        />
      )}
    </section>
  );
}
