"use client";

import { PointsListTile } from "@/components/places/PointsListTile";
import { useTranslation } from "@/lib/i18n";
import { MOUNTAIN_PEAKS } from "@/lib/places/points-of-interest";
import type { WeatherBundle } from "@/types/weather";

export function MountainsTile({ weather }: { weather: WeatherBundle }) {
  const { dict } = useTranslation();
  return (
    <PointsListTile
      weather={weather}
      title={dict.places.mountains}
      set="mountains"
      points={MOUNTAIN_PEAKS}
      itemLabel="peaks"
      showElevation
      caveat={dict.places.mountainsCaveat}
    />
  );
}
