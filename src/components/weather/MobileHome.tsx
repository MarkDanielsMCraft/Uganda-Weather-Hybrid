"use client";

import { SevereAlertBanner } from "@/components/alerts/SevereAlertBanner";
import { HourlyStrip } from "@/components/weather/HourlyStrip";
import { DailyOutlook } from "@/components/weather/DailyOutlook";
import { WeatherHero } from "@/components/weather/WeatherHero";
import { HomeTileGrid } from "@/components/weather/HomeTileGrid";
import { ModulePageActions } from "@/components/layout/ModulePageActions";
import { WeatherStatusFooter } from "@/components/weather/WeatherStatusFooter";
import type { ReactNode } from "react";
import type { ApiMeta, WeatherBundle } from "@/types/weather";

export function MobileHome({
  weather,
  meta,
  placeSubtitle,
  lakeShoreOverride,
  reference,
}: {
  weather: WeatherBundle;
  meta?: ApiMeta;
  placeSubtitle?: string;
  lakeShoreOverride?: string;
  /** Rendered above the data source line, so it sits inside the page rather
      than after the line that reads as the end of it. */
  reference?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-4 pb-2">
      <SevereAlertBanner />

      <WeatherHero
        weather={weather}
        meta={meta}
        placeSubtitle={placeSubtitle}
        showProviderStatus={false}
      />

      <HourlyStrip weather={weather} />

      <div data-tile-id="forecast">
        <DailyOutlook weather={weather} />
      </div>

      <HomeTileGrid weather={weather} lakeShoreOverride={lakeShoreOverride} />

      <ModulePageActions weather={weather} />

      {reference}

      <WeatherStatusFooter weather={weather} meta={meta} className="px-1 pt-2 text-center" />
    </div>
  );
}
