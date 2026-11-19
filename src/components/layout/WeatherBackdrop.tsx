"use client";

import { WeatherBackground } from "@/components/effects/WeatherBackground";
import { useAppReady } from "@/hooks/useAppReady";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { useLiteScene } from "@/hooks/useLiteScene";
import { usePreferencesStore } from "@/stores/preferencesStore";

export function WeatherBackdrop() {
  const ready = useAppReady();
  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const activePlace = usePreferencesStore((s) => s.activePlace);
  const liteMode = useLiteScene();
  const { data } = useWeatherBundle(districtSlug, ready, activePlace);

  const weather = ready ? data?.data : undefined;
  const theme = weather?.condition.theme ?? "partly_cloudy";
  const isDay = weather?.isDay ?? true;
  const rainy = theme === "rain" || theme === "thunder";
  const rainIntensity = Math.max(
    weather?.precipitation.mm ?? 0,
    rainy ? 2.5 : 0,
  );

  return (
    <WeatherBackground
      theme={theme}
      isDay={isDay}
      region={weather?.district.region}
      liteMode={liteMode}
      rainIntensity={rainIntensity}
      windDegree={weather?.wind.degree ?? 90}
      moonIllumination={weather?.astronomy.moonIllumination ?? 49}
      moonPhase={weather?.astronomy.moonPhase ?? "Last Quarter"}
    />
  );
}
