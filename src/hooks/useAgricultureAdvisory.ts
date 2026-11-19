"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlaceLocation } from "@/lib/places/types";
import type { AgricultureAdvisory } from "@/lib/agriculture/advisory";
import type { ApiMeta } from "@/types/weather";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useAppReady } from "@/hooks/useAppReady";

interface WeeklyRainDay {
  day: string;
  date: string;
  rainChance: number;
}

interface AgricultureAdvisoryResponse {
  data: AgricultureAdvisory & {
    district: {
      slug: string;
      name: string;
      region: string;
      agroZone: string;
      rainfallPattern: string;
    };
    weeklyRainChance: WeeklyRainDay[];
    updatedAt: string;
    source: string;
  };
  meta: ApiMeta;
}

function agricultureRequestUrl(input: {
  districtSlug: string;
  activePlace: PlaceLocation | null;
}) {
  if (input.activePlace) {
    const params = new URLSearchParams({
      place: input.activePlace.key,
      name: input.activePlace.name,
      lat: String(input.activePlace.lat),
      lon: String(input.activePlace.lon),
      label: input.activePlace.label,
      parent: input.activePlace.parentDistrictSlug,
    });
    return `/api/v1/agriculture/advisory?${params.toString()}`;
  }

  return `/api/v1/agriculture/advisory?district=${encodeURIComponent(input.districtSlug)}`;
}

export function useAgricultureAdvisory() {
  const ready = useAppReady();
  const { districtSlug, activePlace, weatherKey } = useAppLocation();

  return useQuery({
    queryKey: ["agriculture", weatherKey],
    enabled: ready && weatherKey.length >= 2,
    queryFn: async () => {
      const response = await fetch(
        agricultureRequestUrl({ districtSlug, activePlace }),
      );
      if (!response.ok) throw new Error("Failed to load agriculture advisory");
      return (await response.json()) as AgricultureAdvisoryResponse;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export type { WeeklyRainDay };
