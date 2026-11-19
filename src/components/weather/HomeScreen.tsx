"use client";

import { useEffect, useState } from "react";
import { AlertsDetailContent } from "@/components/alerts/AlertsDetailContent";
import { DistrictReference } from "@/components/district/DistrictReference";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { DesktopDashboard } from "@/components/weather/DesktopDashboard";
import { MobileHome } from "@/components/weather/MobileHome";
import { WeatherPageSkeleton } from "@/components/weather/WeatherPageSkeleton";
import { useActiveAlerts } from "@/hooks/useActiveAlerts";
import { useAppLocation } from "@/hooks/useAppLocation";
import { findTileElement } from "@/lib/home/tileRegistry";
import { useModuleWeather } from "@/hooks/useModuleWeather";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { useTranslation } from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { getDistrictBySlug } from "@/lib/districts";

/** Isolated leaf component so HomeScreen itself never subscribes to
    DetailSheetContext (which would re-render the entire tile grid every
    time a WidgetTile opens or updates the sheet). */
function AlertsFallbackSheetOpener({
  districtHazards,
}: {
  districtHazards: string[];
}) {
  const { dict } = useTranslation();
  const { openSheet } = useDetailSheet();
  const { alerts } = useActiveAlerts();
  const { alertsDistrictSlug } = useAppLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const element = findTileElement("alerts");
      if (element) return;
      openSheet({
        tileId: "alerts",
        title: dict.alerts.severeWeatherAlert,
        anchorEl: null,
        content: (
          <AlertsDetailContent
            alerts={alerts}
            districtSlug={alertsDistrictSlug}
            hazards={districtHazards}
          />
        ),
      });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [openSheet, dict.alerts.severeWeatherAlert, alerts, alertsDistrictSlug, districtHazards]);

  return null;
}

/** The home screen — one continuous tile grid with every module folded
    directly in. This is what "/" renders, and also what every module's
    dedicated route (/forecast, /map, /alerts, /agriculture,
    /lake-victoria) now renders too, so those URLs keep working for direct
    links and shares without being a separate page layout. `autoOpenTileId`
    scrolls to and opens that tile's sheet once the grid has rendered;
    "forecast" has no sheet to open (10-Day is already fully expanded
    inline), so it only scrolls. */
export function HomeScreen({
  autoOpenTileId,
  lakeShoreOverride,
}: {
  autoOpenTileId?: string;
  lakeShoreOverride?: string;
}) {
  const isDesktop = useIsLgUp();
  const { dict } = useTranslation();
  const { weather, meta, waiting, isError, isFetching, displaySubtitle } = useModuleWeather();
  const { refresh, isRefreshing } = useRefreshWeather();
  const [slowLoad, setSlowLoad] = useState(false);
  const districtSlug = usePreferencesStore((state) => state.districtSlug);

  // These routes all show one district's weather, so they carry that
  // district's About card too. It was previously only on /district/[slug],
  // which meant the card was invisible to anyone who never left the home
  // screen. Rendered on the client here, since the district is a client side
  // choice; the district route keeps its server rendered copy, which is the
  // one that has to reach a crawler.
  const district = getDistrictBySlug(districtSlug);
  const reference = district ? <DistrictReference district={district} /> : null;

  useEffect(() => {
    if (!waiting) {
      setSlowLoad(false);
      return;
    }

    const timer = window.setTimeout(() => setSlowLoad(true), 4000);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    if (!autoOpenTileId || !weather) return;
    const timer = window.setTimeout(() => {
      const element = findTileElement(autoOpenTileId);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if (autoOpenTileId !== "forecast") {
        element.querySelector("button")?.click();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [autoOpenTileId, weather]);

  if (waiting) {
    return (
      <div className="space-y-3">
        <WeatherPageSkeleton districtName={district?.name ?? "Kampala"} />
        {slowLoad && (
          <p className="px-1 text-center text-[14px] text-white/45">
            {dict.common.stillLoadingWeather}
          </p>
        )}
        {reference}
      </div>
    );
  }

  if (isError && !weather) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[17px] text-[#ff8a7a]">{dict.common.couldNotLoadWeather}</p>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={isRefreshing}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[14px] text-white/85 disabled:opacity-50"
        >
          {isRefreshing ? dict.common.retrying : dict.common.retry}
        </button>
        {(isFetching || isRefreshing) && (
          <p className="text-[14px] text-white/45">{dict.common.retrying}</p>
        )}
        {reference}
      </div>
    );
  }

  if (!weather) {
    return (
      <>
        <WeatherPageSkeleton />
        {reference}
      </>
    );
  }

  return (
    <>
      {autoOpenTileId === "alerts" && (
        <AlertsFallbackSheetOpener districtHazards={district?.hazards ?? []} />
      )}
      {isDesktop ? (
        <DesktopDashboard
          weather={weather}
          meta={meta}
          placeSubtitle={displaySubtitle}
          lakeShoreOverride={lakeShoreOverride}
          reference={reference}
        />
      ) : (
        <MobileHome
          weather={weather}
          meta={meta}
          placeSubtitle={displaySubtitle}
          lakeShoreOverride={lakeShoreOverride}
          reference={reference}
        />
      )}
    </>
  );
}
