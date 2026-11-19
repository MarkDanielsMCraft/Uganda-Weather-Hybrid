import { HourlyStrip } from "@/components/weather/HourlyStrip";
import { WeatherHero } from "@/components/weather/WeatherHero";
import { HomeTileGrid } from "@/components/weather/HomeTileGrid";
import { ModulePageActions } from "@/components/layout/ModulePageActions";
import { SevereAlertBanner } from "@/components/alerts/SevereAlertBanner";
import { WeatherStatusFooter } from "@/components/weather/WeatherStatusFooter";
import type { ReactNode } from "react";
import type { ApiMeta, WeatherBundle } from "@/types/weather";

export function DesktopDashboard({
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
    <div className="px-6 pb-16 pt-2 lg:px-10">
      <SevereAlertBanner />

      <WeatherHero
        weather={weather}
        meta={meta}
        desktop
        placeSubtitle={placeSubtitle}
        showProviderStatus={false}
      />

      {/*
        No separate "go to this page" card grid here — every module lives
        directly in the tile grid below, so there's nothing left to link
        out to. Hourly stays full width above everything.
      */}
      <div className="mt-3">
        <HourlyStrip weather={weather} />
      </div>

      <div className="mt-4">
        <HomeTileGrid weather={weather} lakeShoreOverride={lakeShoreOverride} showForecastTile />
      </div>

      <ModulePageActions weather={weather} />

      {reference}

      <WeatherStatusFooter weather={weather} meta={meta} className="mt-8 text-center" />
    </div>
  );
}
