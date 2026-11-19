"use client";

import { PointsListTile } from "@/components/places/PointsListTile";
import { useTranslation } from "@/lib/i18n";
import { NATIONAL_PARKS } from "@/lib/places/points-of-interest";
import type { WeatherBundle } from "@/types/weather";

export function NationalParksTile({ weather }: { weather: WeatherBundle }) {
  const { dict } = useTranslation();
  return (
    <PointsListTile
      weather={weather}
      title={dict.places.nationalParks}
      set="parks"
      points={NATIONAL_PARKS}
      itemLabel="parks"
    />
  );
}
