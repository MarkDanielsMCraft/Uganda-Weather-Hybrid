"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { getMajorLocations } from "@/lib/districts";
import { themeTileStyle } from "@/lib/design/theme-visuals";
import { useAppReady } from "@/hooks/useAppReady";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import type { WeatherTheme } from "@/types/weather";

const chipTextShadow = "0 1px 3px rgba(0,0,0,0.5)";

export interface ChipWeather {
  slug: string;
  tempC: number;
  icon: string;
  theme: WeatherTheme;
}

// One batched request for the whole chip strip instead of one
// `/api/v1/weather/current` call per chip (~19 major locations) — that
// per-chip fanout alone used to eat a third of the shared per-IP
// rate-limit budget on every single page load.
export async function fetchChipWeather(): Promise<ChipWeather[]> {
  const response = await fetch("/api/v1/weather/chips");
  if (!response.ok) throw new Error("Failed");
  const payload = await response.json();
  return payload.data?.chips ?? [];
}

export function CityChipsTrack() {
  const ready = useAppReady();
  const isDesktop = useIsLgUp();
  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const activePlace = usePreferencesStore((s) => s.activePlace);
  const { selectDistrict } = useDistrictNavigation();
  const { data: activeBundle } = useWeatherBundle(districtSlug, ready, activePlace);
  const activeWeather = activeBundle?.data;

  const popular = getMajorLocations();
  // Cities (Kampala plus every isCity-flagged entry) lead the strip in
  // alphabetical order, then major towns/districts follow, also
  // alphabetical.
  const orderedPopular = useMemo(
    () =>
      [...popular].sort((a, b) => {
        const aIsCity = a.isCity || a.slug === "kampala";
        const bIsCity = b.isCity || b.slug === "kampala";
        if (aIsCity !== bIsCity) return aIsCity ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [popular],
  );

  const { data: chipWeather } = useQuery({
    queryKey: ["topbar-chip-weather"],
    queryFn: fetchChipWeather,
    staleTime: 5 * 60 * 1000,
    enabled: ready && isDesktop,
  });

  const chipWeatherBySlug = useMemo(() => {
    const map = new Map<string, ChipWeather>();
    for (const chip of chipWeather ?? []) map.set(chip.slug, chip);
    return map;
  }, [chipWeather]);

  // Rendered twice back to back (see chip-marquee-track in globals.css) so
  // the drift loop is seamless — the duplicate copy is hidden from
  // assistive tech and keyboard tab order so it doesn't read/land twice.
  function renderChips(copy: "primary" | "duplicate") {
    const duplicate = copy === "duplicate";
    return orderedPopular.map((district) => {
      const summary = chipWeatherBySlug.get(district.slug);
      const active = !activePlace && district.slug === districtSlug;
      const effectiveSummary =
        active && activeWeather
          ? {
              slug: district.slug,
              tempC: Math.round(activeWeather.temperature.celsius),
              icon: activeWeather.condition.icon,
              theme: activeWeather.condition.theme,
            }
          : summary;

      if (!effectiveSummary) {
        return (
          <div
            key={`${district.slug}-${copy}`}
            aria-hidden={duplicate || undefined}
            className="h-11 w-[132px] shrink-0 animate-pulse rounded-full bg-white/10"
          />
        );
      }

      const tile = themeTileStyle(effectiveSummary.theme);

      return (
        <button
          key={`${district.slug}-${copy}`}
          type="button"
          tabIndex={duplicate ? -1 : undefined}
          aria-hidden={duplicate || undefined}
          onClick={() => selectDistrict(district.slug)}
          className={`relative flex h-11 shrink-0 items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-left transition backdrop-blur-md ${
            active ? "border-white/35 bg-white/[0.16] ring-1 ring-white/25" : "border-white/[0.14] hover:border-white/25"
          }`}
          style={{ background: `${tile.accent}26` }}
        >
          <WeatherIcon theme={effectiveSummary.theme} icon={effectiveSummary.icon} size={20} className="shrink-0" animated={false} />
          <span className="flex flex-col leading-tight">
            <span className="max-w-[132px] truncate text-[13px] font-medium text-white" style={{ textShadow: chipTextShadow }}>
              {district.name}
            </span>
            <span className="text-[11px] text-white/70" style={{ textShadow: chipTextShadow }}>
              {effectiveSummary.tempC}°
            </span>
          </span>
        </button>
      );
    });
  }

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[rgba(26,21,36,0.95)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[rgba(26,21,36,0.95)] to-transparent" />
      <div className="chip-marquee-track flex w-max items-center gap-2 py-1">
        {renderChips("primary")}
        {renderChips("duplicate")}
      </div>
    </div>
  );
}
