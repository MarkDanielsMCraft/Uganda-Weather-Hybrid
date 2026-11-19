"use client";

import { useRef, useState } from "react";
import { BaseMapTile } from "@/components/map/BaseMapTile";
import { Panel, PanelHeading } from "@/components/glass/GlassCard";
import dynamic from "next/dynamic";
import { useRainViewerRadar } from "@/hooks/useRainViewerRadar";
import { coordinatesForWeather } from "@/lib/weather/location-query";
import { exactTileCoordinates } from "@/lib/geo/tile";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";

const MapExpandedView = dynamic(
  () => import("@/components/weather/MapExpandedView").then((m) => m.MapExpandedView),
  { ssr: false },
);

const PREVIEW_ZOOM = 12;

export function PrecipitationMapWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );
  const coords = coordinatesForWeather(weather.district);
  const { layerTiles } = useRainViewerRadar(coords.lat, coords.lon, PREVIEW_ZOOM, 1);
  const { xGlobal, yGlobal } = exactTileCoordinates(coords.lat, coords.lon, PREVIEW_ZOOM);

  function handleClick() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }

  return (
    <>
      <button ref={buttonRef} type="button" onClick={handleClick} className="block h-full w-full text-left">
        <Panel className="relative flex h-full min-h-[176px] flex-col overflow-hidden transition hover:ring-1 hover:ring-white/20">
          <div className="absolute inset-0 overflow-hidden bg-[#e5e3df]">
            {layerTiles.map(({ tile, radar, radarSizePercent, radarPositionXPercent, radarPositionYPercent }) => {
              const leftOffset = (tile.x - xGlobal) * 256;
              const topOffset = (tile.y - yGlobal) * 256;
              return (
                <div
                  key={`${tile.z}-${tile.x}-${tile.y}`}
                  className="absolute overflow-hidden"
                  style={{
                    left: `calc(50% + ${leftOffset}px)`,
                    top: `calc(50% + ${topOffset}px)`,
                    width: 256,
                    height: 256,
                  }}
                >
                  <BaseMapTile tile={tile} className="absolute inset-0 h-full w-full" />
                  {radar ? (
                    <div
                      className="absolute inset-0 opacity-85 pointer-events-none"
                      style={{
                        backgroundImage: `url(${radar})`,
                        backgroundSize: `${radarSizePercent}% ${radarSizePercent}%`,
                        backgroundPosition: `${radarPositionXPercent}% ${radarPositionYPercent}%`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {/* Razor-sharp drop pin centered on target */}
            <div
              className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              style={{ left: "50%", top: "50%" }}
            >
              <svg width="26" height="34" viewBox="0 0 26 34" fill="none" aria-hidden="true">
                <path
                  d="M13 0C5.82 0 0 5.82 0 13C0 22.75 13 34 13 34C13 34 26 22.75 26 13C26 5.82 20.18 0 13 0Z"
                  fill="var(--color-brand-green)"
                />
                <path
                  d="M13 1C6.37 1 1 6.37 1 13C1 22.1 13 32.7 13 32.7C13 32.7 25 22.1 25 13C25 6.37 19.63 1 13 1Z"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="1.5"
                />
                <circle cx="13" cy="12" r="4.5" fill="#FFFFFF" />
              </svg>
            </div>
          </div>

          {/* Legibility scrims */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="relative z-10 flex flex-1 flex-col p-4">
            <PanelHeading
              title={uiLanguage === "lg" ? dict.navigation.radarMap : "Radar"}
              subtitle={formatDistrictPhrase(
                dict.common.nearDistrict,
                weather.district.name,
                dict,
                uiLanguage,
              )}
            />
            <p className="mt-auto text-[13px] text-white/85 font-medium">
              {weather.precipitation.mm > 0
                ? uiLanguage === "lg"
                  ? `Enkuba ya mm/h ${weather.precipitation.mm} · Kebera mmaapu`
                  : `${weather.precipitation.mm} mm/h rain · View map`
                : uiLanguage === "lg"
                  ? "Tewali nkuba etonnya kati · Kebera mmaapu"
                  : "No rain currently · View map"}
            </p>
          </div>
        </Panel>
      </button>

      {anchorRect && (
        <MapExpandedView weather={weather} anchorRect={anchorRect} onClose={() => setAnchorRect(null)} />
      )}
    </>
  );
}

