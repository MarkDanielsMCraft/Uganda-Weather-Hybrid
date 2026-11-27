"use client";

import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { getDistrictBySlug } from "@/lib/districts";
import { AIRPORTS } from "@/lib/places/points-of-interest";
import { distanceKm } from "@/lib/geo/distance";
import { useTranslation } from "@/lib/i18n";
import { formatWindDirectionLg } from "@/lib/weather/copy-lg";
import { degreesToCompass } from "@/lib/weather/wmo";

export interface MetarReport {
  icaoId: string;
  name: string;
  rawOb: string;
  reportTime: string;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | string | null;
  windSpeedKt: number | null;
  visibility: string | null;
  altimeterHpa: number | null;
  flightCategory: string | null;
}

export const FLIGHT_CATEGORY_LABEL: Record<string, string> = {
  VFR: "Clear, good flying weather",
  MVFR: "Marginal, some cloud or haze",
  IFR: "Poor visibility, instrument flight required",
  LIFR: "Very poor visibility, flights likely restricted",
};

export function windLine(report: MetarReport): string {
  if (report.windSpeedKt == null) return "Calm or not reported";
  if (report.windSpeedKt === 0) return "Calm";
  const direction =
    typeof report.windDirDeg === "number" ? `${degreesToCompass(report.windDirDeg)} at ` : "";
  return `${direction}${report.windSpeedKt} kt`;
}

export function AirportsDetailContent({
  reports,
  from,
}: {
  reports: MetarReport[];
  from: { lat: number; lon: number };
}) {
  const { dict, uiLanguage } = useTranslation();
  const { selectPlace } = useDistrictNavigation();
  const { closeSheet } = useDetailSheet();
  const isLg = uiLanguage === "lg";

  function formatLocalizedWind(report: MetarReport): string {
    if (!isLg) return windLine(report);
    if (report.windSpeedKt == null) return dict.places.calmOrUnreported;
    if (report.windSpeedKt === 0) return dict.places.calm;
    if (typeof report.windDirDeg === "string" && report.windDirDeg.toUpperCase() === "VRB") {
      return dict.places.variableAtSpeed.replace("{speed}", String(report.windSpeedKt));
    }
    if (typeof report.windDirDeg === "number") {
      const compass = degreesToCompass(report.windDirDeg);
      const dir = formatWindDirectionLg(compass);
      return dict.places.atSpeed
        .replace("{dir}", dir)
        .replace("{speed}", String(report.windSpeedKt));
    }
    return `kt ${report.windSpeedKt}`;
  }

  if (reports.length === 0) {
    return (
      <p className="text-[13px] text-white/50">
        {dict.places.airportsUnavailable}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[13px] leading-relaxed text-white/60">
        {dict.places.airportsIntro}
      </p>
      <div>
        {reports.map((report) => {
          const airport = AIRPORTS.find((entry) => entry.icao === report.icaoId);
          const km = airport ? Math.round(distanceKm(from, airport)) : null;
          const category = report.flightCategory ?? undefined;
          const categoryDescription = category
            ? (dict.places.flightCategories[category] ?? FLIGHT_CATEGORY_LABEL[category])
            : undefined;
          return (
            <button
              key={report.icaoId}
              type="button"
              disabled={!airport}
              onClick={() => {
                if (!airport) return;
                closeSheet();
                selectPlace({
                  key: airport.key,
                  name: airport.name,
                  label: airport.label,
                  lat: airport.lat,
                  lon: airport.lon,
                  parentDistrictSlug: airport.parentDistrictSlug,
                  region: getDistrictBySlug(airport.parentDistrictSlug)?.region ?? "central",
                });
              }}
              className="block w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06] disabled:cursor-default"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-white">
                    {(airport && dict.places.items[airport.key]?.name) ?? airport?.name ?? report.name}
                  </p>
                  {km != null && (
                    <p className="text-[13px] text-white/50">
                      {dict.places.kmAway.replace("{km}", String(km))}
                    </p>
                  )}
                </div>
                {category && (
                  <span
                    data-no-narrate
                    className={`text-[12px] font-medium tracking-[0.08rem] text-white/60 ${
                      isLg ? "" : "uppercase"
                    }`}
                  >
                    {category}
                  </span>
                )}
              </div>
              {categoryDescription && (
                <p className="mt-0.5 text-[13px] text-white/60">
                  {categoryDescription}
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-white/72">
                <p>
                  {dict.places.tempLabel}{" "}
                  <span className="text-white">
                    {report.tempC != null ? `${report.tempC}°` : "—"}
                  </span>
                </p>
                <p>
                  {dict.places.dewPointLabel}{" "}
                  <span className="text-white">
                    {report.dewpointC != null ? `${report.dewpointC}°` : "—"}
                  </span>
                </p>
                <p>
                  {dict.places.windLabel} <span className="text-white">{formatLocalizedWind(report)}</span>
                </p>
                <p>
                  {dict.places.visibilityLabel}{" "}
                  <span className="text-white">
                    {report.visibility
                      ? isLg
                        ? `SM ${report.visibility}`
                        : `${report.visibility} SM`
                      : "—"}
                  </span>
                </p>
                <p className="col-span-2">
                  {dict.places.altimeterLabel}{" "}
                  <span className="text-white">
                    {report.altimeterHpa != null
                      ? isLg
                        ? `hPa ${report.altimeterHpa}`
                        : `${report.altimeterHpa} hPa`
                      : "—"}
                  </span>
                </p>
              </div>
              <p data-no-narrate className="mt-2 truncate text-[11px] text-white/35">
                {report.rawOb}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
