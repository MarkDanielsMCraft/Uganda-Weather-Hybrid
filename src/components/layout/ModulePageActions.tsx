"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { SharePlaceLink } from "@/components/weather/SharePlaceLink";
import { sharePathForModule, sharePathForWeather } from "@/lib/places/share";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";

const HOME_PATHS = new Set(["/", "/search"]);

export function ModulePageActions({
  weather,
  sharePath,
  shareLabel,
}: {
  weather: WeatherBundle;
  sharePath?: string;
  shareLabel?: string;
}) {
  const { dict } = useTranslation();
  const pathname = usePathname();
  const { activePlace } = useAppLocation();

  const resolvedSharePath = useMemo(() => {
    if (sharePath) return sharePath;
    const homePath = sharePathForWeather(weather, activePlace);
    if (HOME_PATHS.has(pathname) || pathname.startsWith("/district/")) {
      return homePath;
    }
    return sharePathForModule(pathname, homePath);
  }, [sharePath, weather, activePlace, pathname]);

  const resolvedLabel =
    shareLabel ??
    (HOME_PATHS.has(pathname) || pathname.startsWith("/district/")
      ? dict.common.copyPlaceLink
      : dict.common.copyModuleLink);

  return (
    <div className="-mt-2">
      <SharePlaceLink
        weather={weather}
        sharePath={resolvedSharePath}
        shareLabel={resolvedLabel}
      />
    </div>
  );
}
