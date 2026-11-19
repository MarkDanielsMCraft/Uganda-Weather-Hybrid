"use client";

import Link from "next/link";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { getDistrictBySlug } from "@/lib/districts";
import { placeHomeHref } from "@/lib/places/share";
import { distanceKm } from "@/lib/geo/distance";
import { useTranslation } from "@/lib/i18n";
import { formatConditionLg } from "@/lib/weather/copy-lg";
import type { MountainPeak, PointOfInterest } from "@/lib/places/points-of-interest";

export interface PointWeather {
  key: string;
  name: string;
  tempC: number;
  conditionText: string;
  icon: string;
  theme: string;
  isDay?: boolean;
}

/** Tapping a row hands off to the SAME place weather mechanism the search
    flow already uses (`placeHomeHref` → `/?place=...`) — the whole home
    screen re-renders for that point's real coordinates, no separate
    nested forecast view needed. Points are pre-sorted nearest-first by the
    caller, so what a user in Kabale sees up top is genuinely different
    from what someone in Gulu sees, not the same fixed national list. */
export function PointsListDetailContent({
  points,
  live,
  showElevation,
  caveat,
  from,
}: {
  points: Array<PointOfInterest | MountainPeak>;
  live: Map<string, PointWeather>;
  showElevation: boolean;
  caveat?: string;
  from: { lat: number; lon: number };
}) {
  const { dict, uiLanguage } = useTranslation();
  const { selectPlace } = useDistrictNavigation();
  const { closeSheet } = useDetailSheet();
  const isLg = uiLanguage === "lg";

  return (
    <div className="space-y-1">
      {caveat && (
        <p className="mb-2 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-white/65">
          {caveat}
        </p>
      )}
      {points.map((point) => {
        const weather = live.get(point.key);
        const km = Math.round(distanceKm(from, point));
        const localized = dict.places.items[point.key];
        const pointName = localized?.name ?? point.name;
        const pointLabel = localized?.label ?? point.label;
        const pointBlurb = localized?.blurb ?? point.blurb;
        return (
          <Link
            key={point.key}
            href={placeHomeHref(point)}
            onClick={(event) => {
              event.preventDefault();
              closeSheet();
              selectPlace({
                key: point.key,
                name: point.name,
                label: point.label,
                lat: point.lat,
                lon: point.lon,
                parentDistrictSlug: point.parentDistrictSlug,
                region: getDistrictBySlug(point.parentDistrictSlug)?.region ?? "central",
              });
            }}
            className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.06]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white">{pointName}</p>
              <p className="mt-0.5 text-[13px] text-white/55">
                {pointLabel} · {dict.places.kmAway.replace("{km}", km.toLocaleString())}
                {showElevation && "elevationM" in point
                  ? ` · ${isLg ? `mita ${point.elevationM.toLocaleString()}` : `${point.elevationM.toLocaleString()} m`}`
                  : ""}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/65">{pointBlurb}</p>
            </div>
            <div className="shrink-0 text-right">
              {weather ? (
                <>
                  <p className="text-[20px] font-medium text-white">{weather.tempC}°</p>
                  <p className="text-[13px] text-white/55">
                    {isLg ? formatConditionLg(weather.conditionText, weather.isDay ?? true) : weather.conditionText}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-white/45">{dict.common.unavailable}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
