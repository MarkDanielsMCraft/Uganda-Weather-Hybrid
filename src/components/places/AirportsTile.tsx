"use client";

import { useQuery } from "@tanstack/react-query";
import { WidgetTile } from "@/components/glass/WidgetTile";
import { AIRPORTS } from "@/lib/places/points-of-interest";
import { distanceKm, sortByDistance } from "@/lib/geo/distance";
import { useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";
import {
  AirportsDetailContent,
  type MetarReport,
} from "@/components/places/AirportsDetailContent";

export async function fetchMetarReports(): Promise<MetarReport[]> {
  try {
    const response = await fetch("/api/v1/weather/metar");
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.data?.reports ?? [];
  } catch {
    return [];
  }
}

export function AirportsTile({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const { data } = useQuery({
    queryKey: ["metar-reports"],
    queryFn: fetchMetarReports,
    staleTime: 5 * 60 * 1000,
  });

  const reports = data ?? [];
  const vfrCount = reports.filter((report) => report.flightCategory === "VFR").length;
  const from = weather.district.coordinates;
  const nearestAirport = sortByDistance(AIRPORTS, from)[0];
  const nearestKm = nearestAirport ? Math.round(distanceKm(from, nearestAirport)) : null;
  const sortedReports = sortByDistance(
    reports.map((report) => ({
      ...report,
      lat: AIRPORTS.find((entry) => entry.icao === report.icaoId)?.lat ?? 0,
      lon: AIRPORTS.find((entry) => entry.icao === report.icaoId)?.lon ?? 0,
    })),
    from,
  );

  const localizedNearestName = nearestAirport
    ? (dict.places.items[nearestAirport.key]?.name ?? nearestAirport.name)
    : "";

  const footerText = data
    ? dict.places.airportsClear
        .replace("{clear}", String(vfrCount))
        .replace("{total}", String(reports.length))
    : dict.places.stationsTracked.replace("{count}", String(AIRPORTS.length));

  const nearestText = nearestAirport
    ? isLuganda
      ? `${dict.places.nearest}: ${localizedNearestName}, km ${nearestKm} okuva wano`
      : `Nearest: ${nearestAirport.name}, ${nearestKm} km away`
    : dict.places.airportsSubtext;

  return (
    <WidgetTile
      title={dict.places.airports}
      theme={weather.condition.theme}
      footer={footerText}
      detail={<AirportsDetailContent reports={sortedReports} from={from} />}
    >
      <p className="text-[20px] font-semibold leading-snug text-white">
        {isLuganda
          ? `Ebisaawe by'ennyonyi ${AIRPORTS.length}`
          : `${AIRPORTS.length} ${dict.places.airportsCount}`}
      </p>
      <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/80">{nearestText}</p>
    </WidgetTile>
  );
}
