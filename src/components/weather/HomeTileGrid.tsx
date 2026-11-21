import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AveragesWidget, averagesQueryOptions } from "@/components/weather/AveragesWidget";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import { useFillRemainingColumns } from "@/hooks/useFillRemainingColumns";
import { DailyOutlook } from "@/components/weather/DailyOutlook";
import { PrecipitationMapWidget } from "@/components/weather/PrecipitationMapWidget";
import { WindWidget } from "@/components/weather/WindWidget";
import { WidgetPanelLike } from "@/components/glass/WidgetTile";
import { themeTileStyle } from "@/lib/design/theme-visuals";
import {
  AirQualityWidget,
  AlertWidget,
  FeelsLikeWidget,
  HumidityWidget,
  MoonWidget,
  PrecipitationWidget,
  PressureWidget,
  SunsetWidget,
  UvWidget,
  VisibilityWidget,
} from "@/components/weather/widgets";
import { LiteModeToggle } from "@/components/settings/LiteModeToggle";
import { AccessibilityControls } from "@/components/settings/AccessibilityControls";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { AgricultureTile } from "@/components/agriculture/AgricultureTile";
import { LakeVictoriaTile } from "@/components/lake-victoria/LakeVictoriaTile";
import { LakeTile } from "@/components/lake/LakeTile";
import { KYOGA_CONFIG, ALBERT_CONFIG, EDWARD_CONFIG } from "@/lib/marine/lake-conditions";
import { isLakeShoreSlug } from "@/lib/places/share";
import { NationalParksTile } from "@/components/places/NationalParksTile";
import { MountainsTile } from "@/components/places/MountainsTile";
import { AirportsTile } from "@/components/places/AirportsTile";
import { useActiveAlerts } from "@/hooks/useActiveAlerts";
import { useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";

/** The single tile grid shared by DesktopDashboard and MobileHome — one
    source of truth for tile order and which tiles apply to the current
    district, so the two no longer hand-maintain separate, drifting lists
    (Alerts used to only exist on mobile; Agriculture and Lake Victoria
    used to be entire separate pages neither dashboard linked into
    directly). `grid-flow-dense` packs the mixed small/medium/large tiles
    without gaps automatically, replacing the by-hand row math the grid
    used to need re-verifying every time a tile was added or removed.

    Column base is 4 at desktop, not 3. Our own reference sizes
    (Small ~155px, Medium ~320px, against a ~1000px content width once
    the 10-Day column to the left is accounted for) put Small at roughly
    a quarter of the remaining width, not a third, so this grid needs one
    more column than it had before for its col-span-1 / col-span-2 tiles
    to land at the right proportions relative to each other.

    On desktop, 10-Day is a tile IN this grid (tall, one column wide)
    rather than a separate sidebar column beside it — a fixed-width column
    outside the grid can never be gap-filled by grid-flow-dense, since
    dense packing only works within a single grid container, which is
    exactly why that layout used to leave a dead strip of empty space
    below a short 10-Day list next to a much taller tile column. Folding
    it in lets the same auto-placement that already avoids gaps elsewhere
    pack small tiles in beside/below it too. Mobile keeps 10-Day as its
    own full-width block above this grid (`showForecastTile` stays false
    there), since a tall single-column tile doesn't mean anything in a
    single-column mobile layout. */
export function HomeTileGrid({
  weather,
  lakeShoreOverride,
  showForecastTile = false,
}: {
  weather: WeatherBundle;
  lakeShoreOverride?: string;
  showForecastTile?: boolean;
}) {
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const { alerts } = useActiveAlerts();
  const accent = themeTileStyle(weather.condition.theme).accent;
  const settingsTileStyle = {
    background: `linear-gradient(155deg, ${accent}33 0%, ${accent}12 45%, transparent 75%), rgba(20,18,28,0.6)`,
  };
  // A shore override belongs to exactly one lake — without checking
  // membership, a Kyoga shoreline link would incorrectly also show the
  // Victoria/Albert/Edward tiles, since they'd all see the same truthy
  // `lakeShoreOverride` string.
  const overrideBelongsTo = (config: { shorelineDistricts: readonly { slug: string }[] }) =>
    Boolean(lakeShoreOverride && config.shorelineDistricts.some((shore) => shore.slug === lakeShoreOverride));

  // Same query key AveragesWidget uses — React Query dedupes these into
  // one shared request, so this costs nothing extra. Whether Averages
  // ends up taking a grid slot affects how many tiles precede the
  // settings tile, which is one of several things (alerts, lake tiles)
  // that shift how the row math works out.
  const { data: average, isLoading: averagesLoading } = useQuery(
    averagesQueryOptions(weather.district),
  );
  const averagesTakesSlot = averagesLoading || Boolean(average);

  // Hand-simulating where grid-flow-dense will land the settings tile
  // turned out to be unreliable — an odd number of medium (col-span-2)
  // tiles before it (e.g. when Alerts is also active) breaks the "small
  // tiles always start on a fresh row" assumption a formula depends on.
  // Real rendered layout is the only thing that reflects dense-packing's
  // actual decisions, so this measures it directly instead of guessing:
  // see where the browser actually placed the tile, then span it to the
  // container's right edge.
  const isDesktop = useIsLgUp();
  const [showAllMobileTiles, setShowAllMobileTiles] = useState(false);
  const showSecondaryTiles = isDesktop || showAllMobileTiles;
  const gridRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsSpan = useFillRemainingColumns(gridRef, settingsRef, isDesktop ? 4 : 2, [
    weather.district.slug,
    weather.district.lakeZone,
    lakeShoreOverride,
    showForecastTile,
    alerts.length,
    averagesTakesSlot,
    isDesktop,
    showAllMobileTiles,
  ]);

  return (
    <div ref={gridRef} className="grid grid-flow-dense grid-cols-2 gap-3 lg:grid-cols-4">
      {showForecastTile && (
        <div data-tile-id="forecast" className="hidden lg:col-span-1 lg:row-span-4 lg:block lg:min-h-[720px]">
          <DailyOutlook weather={weather} compact />
        </div>
      )}

      {alerts.length > 0 && (
        <div data-tile-id="alerts" className="col-span-2 min-h-[176px]">
          <AlertWidget />
        </div>
      )}

      <div data-tile-id="agriculture" className="col-span-2 min-h-[176px]">
        <AgricultureTile weather={weather} />
      </div>

      {(weather.district.isLakeVictoriaZone || isLakeShoreSlug(lakeShoreOverride)) && (
        <div data-tile-id="lake-victoria" className="col-span-2 min-h-[176px]">
          <LakeVictoriaTile shoreOverride={lakeShoreOverride ?? null} />
        </div>
      )}

      {(weather.district.lakeZone === "kyoga" || overrideBelongsTo(KYOGA_CONFIG)) && (
        <div data-tile-id="lake-kyoga" className="col-span-2 min-h-[176px]">
          <LakeTile config={KYOGA_CONFIG} shoreOverride={lakeShoreOverride ?? null} />
        </div>
      )}

      {(weather.district.lakeZone === "albert" || overrideBelongsTo(ALBERT_CONFIG)) && (
        <div data-tile-id="lake-albert" className="col-span-2 min-h-[176px]">
          <LakeTile config={ALBERT_CONFIG} shoreOverride={lakeShoreOverride ?? null} />
        </div>
      )}

      {(weather.district.lakeZone === "edward" || overrideBelongsTo(EDWARD_CONFIG)) && (
        <div data-tile-id="lake-edward" className="col-span-2 min-h-[176px]">
          <LakeTile config={EDWARD_CONFIG} shoreOverride={lakeShoreOverride ?? null} />
        </div>
      )}

      <div data-tile-id="map" className="col-span-2 row-span-2 min-h-[360px]">
        <PrecipitationMapWidget weather={weather} />
      </div>

      <div className="col-span-2 min-h-[176px]">
        <WindWidget weather={weather} />
      </div>

      <div data-tile-id="air-quality" className="col-span-2 min-h-[176px]">
        <AirQualityWidget weather={weather} />
      </div>

      {!isDesktop && (
        <div className="col-span-2 pt-1">
          <button
            type="button"
            onClick={() => setShowAllMobileTiles((prev) => !prev)}
            aria-expanded={showAllMobileTiles}
            data-testid="mobile-more-details-toggle"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-[14px] font-semibold text-white/90 backdrop-blur-xl transition hover:bg-white/[0.14] active:scale-[0.99]"
          >
            <span>
              {showAllMobileTiles
                ? isLuganda
                  ? "Kweka ebisingawo"
                  : "Show fewer details"
                : isLuganda
                  ? "Laga ebisingawo ku budde"
                  : "More weather details"}
            </span>
            <svg
              viewBox="0 0 12 12"
              fill="none"
              className={`h-3.5 w-3.5 transition-transform ${showAllMobileTiles ? "rotate-180" : ""}`}
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {showSecondaryTiles && (
        <>
          <div data-tile-id="national-parks" className="col-span-2 min-h-[176px]">
            <NationalParksTile weather={weather} />
          </div>

          <div data-tile-id="mountains" className="col-span-2 min-h-[176px]">
            <MountainsTile weather={weather} />
          </div>

          <div data-tile-id="airports" className="col-span-2 min-h-[176px]">
            <AirportsTile weather={weather} />
          </div>

          <UvWidget weather={weather} />
          <SunsetWidget weather={weather} />
          <FeelsLikeWidget weather={weather} />
          <PrecipitationWidget weather={weather} />

          <div className={`col-span-2 ${isLuganda ? "min-h-[176px]" : "min-h-[148px]"}`}>
            <MoonWidget weather={weather} />
          </div>

          <HumidityWidget weather={weather} />
          <VisibilityWidget weather={weather} />
          <PressureWidget weather={weather} />
          <AveragesWidget weather={weather} />

          <div ref={settingsRef} style={{ gridColumn: `span ${settingsSpan}` }}>
            <WidgetPanelLike
              className="flex h-[176px] flex-col justify-between overflow-visible"
              style={settingsTileStyle}
            >
              <LanguageSwitcher />
              <LiteModeToggle />
              <AccessibilityControls compact />
            </WidgetPanelLike>
          </div>
        </>
      )}
    </div>
  );
}
