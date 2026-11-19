"use client";

import { useQuery } from "@tanstack/react-query";
import { WidgetTile } from "@/components/glass/WidgetTile";
import { distanceKm, sortByDistance } from "@/lib/geo/distance";
import { useTranslation } from "@/lib/i18n";
import type { MountainPeak, PointOfInterest } from "@/lib/places/points-of-interest";
import type { WeatherBundle } from "@/types/weather";
import {
  PointsListDetailContent,
  type PointWeather,
} from "@/components/places/PointsListDetailContent";

export async function fetchPoints(set: "parks" | "mountains"): Promise<PointWeather[]> {
  try {
    const response = await fetch(`/api/v1/weather/points?set=${set}`);
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.data?.points ?? [];
  } catch {
    return [];
  }
}

export function PointsListTile({
  weather,
  title,
  set,
  points,
  itemLabel,
  showElevation = false,
  caveat,
}: {
  weather: WeatherBundle;
  title: string;
  set: "parks" | "mountains";
  points: Array<PointOfInterest | MountainPeak>;
  itemLabel: string;
  showElevation?: boolean;
  caveat?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const { data } = useQuery({
    queryKey: ["points", set],
    queryFn: () => fetchPoints(set),
    staleTime: 5 * 60 * 1000,
  });

  const from = weather.district.coordinates;
  const sortedPoints = sortByDistance(points, from);
  const nearest = sortedPoints[0];
  const nearestKm = nearest ? Math.round(distanceKm(from, nearest)) : null;

  const live = new Map((data ?? []).map((entry) => [entry.key, entry]));
  const clearCount = (data ?? []).filter(
    (entry) => entry.theme === "clear" || entry.theme === "partly_cloudy",
  ).length;

  const localizedItemLabel = isLuganda
    ? set === "parks"
      ? dict.places.parks
      : dict.places.peaks
    : itemLabel;

  const localizedTitle = isLuganda
    ? set === "parks"
      ? dict.places.nationalParks
      : dict.places.mountains
    : title;

  const footerText = data
    ? dict.places.clearAtPoints
        .replace("{item}", localizedItemLabel)
        .replace("{clear}", String(clearCount))
        .replace("{total}", String(points.length))
    : (set === "parks" ? dict.places.trackingParks : dict.places.trackingPeaks).replace(
        "{count}",
        String(points.length),
      );

  const localizedPoint = nearest ? dict.places.items[nearest.key] : undefined;
  const nearestName = localizedPoint?.name ?? nearest?.name ?? "";

  const nearestText = nearest
    ? isLuganda
      ? `${dict.places.nearest}: ${nearestName}, km ${nearestKm} okuva wano`
      : `Nearest: ${nearest.name}, ${nearestKm} km away`
    : dict.places.tapPointConditions;

  return (
    <WidgetTile
      title={localizedTitle}
      theme={weather.condition.theme}
      footer={footerText}
      detail={
        <PointsListDetailContent
          points={sortedPoints}
          live={live}
          showElevation={showElevation}
          caveat={caveat}
          from={from}
        />
      }
    >
      <p className="text-[20px] font-semibold leading-snug text-white">
        {isLuganda
          ? set === "parks"
            ? `Ebikuumiro ${points.length}`
            : `Entikko z'ensozi ${points.length}`
          : `${points.length} ${localizedItemLabel}`}
      </p>
      <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/80">{nearestText}</p>
    </WidgetTile>
  );
}
