"use client";

import { HybridWeatherAdvisor } from "@/components/advisor/HybridWeatherAdvisor";
import { useModuleWeather } from "@/hooks/useModuleWeather";
import { getDistrictBySlug } from "@/lib/districts";

/** Mounts the floating weather advisor once at the main layout root so it is
    available across all routes (home, district pages, lakes, and search) and
    never clipped by scroll containers. */
export function FloatingAdvisorHost() {
  const { weather, slug } = useModuleWeather();
  const district = getDistrictBySlug(slug);

  return (
    <HybridWeatherAdvisor
      weather={weather ?? null}
      districtName={district?.name ?? "Kampala"}
    />
  );
}
