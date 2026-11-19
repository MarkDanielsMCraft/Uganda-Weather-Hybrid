"use client";

import { useQuery } from "@tanstack/react-query";
import { WidgetTile } from "@/components/glass/WidgetTile";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import type { SupportedLocale, TranslationDictionary } from "@/lib/i18n/types";
import { weatherTargetQueryString } from "@/lib/weather/location-query";
import {
  compareHighToNormal,
  type HistoricalNormal,
  type NormalComparison,
} from "@/lib/weather/historical-averages";
import type { District, WeatherBundle } from "@/types/weather";

export async function fetchAverage(target: string | District): Promise<HistoricalNormal | null> {
  try {
    const query =
      typeof target === "string"
        ? `district=${encodeURIComponent(target)}`
        : weatherTargetQueryString(target);
    const response = await fetch(`/api/v1/weather/averages?${query}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data?.average ?? null;
  } catch {
    return null;
  }
}

/** Same query key/options `HomeTileGrid` uses to lift this state up — a
    shared constant so the two stay in sync rather than drifting if either
    is edited independently. */
export function averagesQueryOptions(target: string | District) {
  const key =
    typeof target === "string"
      ? target
      : target.isPlace
        ? weatherTargetQueryString(target)
        : target.slug;
  return {
    queryKey: ["historical-average", key],
    queryFn: () => fetchAverage(target),
    staleTime: 6 * 60 * 60 * 1000,
  } as const;
}

function averagesDetail(
  rawDistrictName: string,
  comparison: NormalComparison,
  dict: Pick<TranslationDictionary, "common">,
  uiLanguage: SupportedLocale,
  todayLabel: string,
  typicalLabel: string,
) {
  if (uiLanguage === "lg") {
    const line =
      comparison.diff === 0
        ? formatDistrictPhrase(
            `Ebbugumu lya leero erisinga waggulu erya ${comparison.actualHigh}° lyenkana n'ekigero eky'olunaku luno mu {district}.`,
            rawDistrictName,
            dict,
            uiLanguage,
          )
        : formatDistrictPhrase(
            `Ebbugumu lya leero erisinga waggulu erya ${comparison.actualHigh}° liri ${Math.abs(comparison.diff)}° ${
              comparison.diff > 0 ? "waggulu w'" : "wansi w'"
            }ekigero eky'olunaku luno mu {district}.`,
            rawDistrictName,
            dict,
            uiLanguage,
          );
    return (
      <>
        <p>{line}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[12px]">
          <div>
            <p className="text-white/40">{todayLabel}</p>
            <p className="mt-0.5 text-[14px] text-white">{comparison.actualHigh}°</p>
          </div>
          <div>
            <p className="text-white/40">{typicalLabel}</p>
            <p className="mt-0.5 text-[14px] text-white">{comparison.normalHigh}°</p>
          </div>
        </div>
        <p className="mt-3">
          {
            "Ekigero kino kye kipimo eky'ebyafaayo eky'ebbugumu erisinga waggulu ku lunaku luno mu kifo kino."
          }
        </p>
      </>
    );
  }

  return (
    <>
      <p>
        {comparison.diff === 0 ? (
          <>
            Today&apos;s high of {comparison.actualHigh}° matches the typical high for{" "}
            {rawDistrictName} on this date.
          </>
        ) : (
          <>
            Today&apos;s high of {comparison.actualHigh}° is {Math.abs(comparison.diff)}°{" "}
            {comparison.diff > 0 ? "above" : "below"} the typical high for{" "}
            {rawDistrictName} on this date.
          </>
        )}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[12px]">
        <div>
          <p className="text-white/40">{todayLabel}</p>
          <p className="mt-0.5 text-[14px] text-white">{comparison.actualHigh}°</p>
        </div>
        <div>
          <p className="text-white/40">{typicalLabel}</p>
          <p className="mt-0.5 text-[14px] text-white">{comparison.normalHigh}°</p>
        </div>
      </div>
      <p className="mt-3">
        &ldquo;Typical&rdquo; is the historical average high for this calendar date at this
        location, not a forecast, and is a useful reference for whether today is running warmer or
        cooler than usual.
      </p>
    </>
  );
}

export function AveragesWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  // Same query key as `useAveragesAvailability` below, so React Query
  // dedupes the two into a single shared request/cache entry rather than
  // fetching twice — HomeTileGrid needs to know whether this tile will
  // render at all, to size the trailing settings tile correctly.
  const { data: normal, isLoading } = useQuery(averagesQueryOptions(weather.district));

  // Today's high comes from this app's own provider chain, not from the
  // climate service. Reading both numbers off one Visual Crossing response
  // compared the normal against itself: every district reported exactly
  // "0 at average", under a label that said "Today".
  const comparison = normal ? compareHighToNormal(weather.daily.high, normal) : null;

  // No fabricated data when the provider isn't configured or the call
  // fails — the tile just doesn't take a grid slot, same as Air Quality's
  // PM2.5 degrading to "Not reported" rather than inventing a number.
  if (!isLoading && !normal) return null;
  if (isLoading) {
    return <div className="min-h-[148px] animate-pulse rounded-[22px] bg-white/5" />;
  }

  const footerText = normal
    ? isLuganda
      ? `Ebbugumu erisinga waggulu erya bulijjo leero: ${normal.normalHigh}°.`
      : `Today's average high: ${normal.normalHigh}°.`
    : undefined;

  const comparisonLabel = comparison
    ? comparison.diff > 0
      ? dict.metrics.aboveAverage
      : comparison.diff < 0
      ? dict.metrics.belowAverage
      : dict.metrics.atAverage
    : "";

  return (
    <WidgetTile
      title={dict.metrics.averages}
      footer={footerText}
      theme={weather.condition.theme}
      detail={
        comparison
          ? averagesDetail(
              weather.district.name,
              comparison,
              dict,
              uiLanguage,
              dict.common.today,
              dict.metrics.typical,
            )
          : undefined
      }
    >
      {comparison && !isLuganda && (
        <p className="text-[34px] font-medium text-white">
          {comparison.diff > 0 ? "+" : ""}
          {comparison.diff}°
          <span className="ml-2 text-[16px] font-normal text-white/75">
            {comparison.diff > 0 ? "above" : comparison.diff < 0 ? "below" : "at"} average
          </span>
        </p>
      )}
      {comparison && isLuganda && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-[34px] font-medium leading-tight text-white">
          <span>
            {comparison.diff > 0 ? "+" : ""}
            {comparison.diff}°
          </span>
          <span className="text-[15px] font-normal leading-snug text-white/75">
            {comparisonLabel}
          </span>
        </p>
      )}
    </WidgetTile>
  );
}
