"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BaseMapTile } from "@/components/map/BaseMapTile";
import { useRainViewerRadar } from "@/hooks/useRainViewerRadar";
import { formatUgandaDateTime } from "@/lib/time/uganda";
import { coordinatesForWeather } from "@/lib/weather/location-query";
import { exactTileCoordinates, radarOverlayPlacement, rainViewerTileUrl, type MapTile } from "@/lib/geo/tile";
import { useTranslation, localizeDistrictName, formatDistrictPhrase } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n/types";
import type { WeatherBundle } from "@/types/weather";

const MIN_ZOOM = 6;
const MAX_ZOOM = 15;
const OUTER_MARGIN = 16;

function formatFrameTime(unixSeconds: number, language: SupportedLocale) {
  return (
    formatUgandaDateTime(
      new Date(unixSeconds * 1000),
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
      language,
    ) ?? ""
  );
}

export function MapExpandedView({
  weather,
  anchorRect,
  onClose,
}: {
  weather: WeatherBundle;
  anchorRect: { top: number; left: number; width: number; height: number };
  onClose: () => void;
}) {
  const { dict, uiLanguage } = useTranslation();
  const r = dict.sheets.radar;
  const coords = coordinatesForWeather(weather.district);
  const [zoom, setZoom] = useState(12);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 390 : window.innerWidth,
    height: typeof window === "undefined" ? 844 : window.innerHeight,
  }));
  const dragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const {
    frames,
    frameIndex,
    activeFrame,
    pastCount,
    loading,
    error,
    playing,
    setFrameIndex,
    togglePlay,
    refetch,
  } = useRainViewerRadar(coords.lat, coords.lon, zoom, 1);
  const isNowcast = frameIndex >= pastCount && pastCount > 0;
  const host = "https://tilecache.rainviewer.com";

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>(".main-scroll");
    const prevScrollOverflow = scrollContainer?.style.overflow;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (scrollContainer) {
      scrollContainer.style.overflow = "hidden";
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (scrollContainer && prevScrollOverflow !== undefined) {
        scrollContainer.style.overflow = prevScrollOverflow;
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const { xGlobal, yGlobal } = exactTileCoordinates(coords.lat, coords.lon, zoom);
  const centerTileX = Math.floor(xGlobal - pan.x / 256);
  const centerTileY = Math.floor(yGlobal - pan.y / 256);

  const visibleTiles = useMemo(() => {
    const list: MapTile[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        list.push({ x: centerTileX + dx, y: centerTileY + dy, z: zoom });
      }
    }
    return list;
  }, [centerTileX, centerTileY, zoom]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({
      x: dragRef.current.initialPanX + dx,
      y: dragRef.current.initialPanY + dy,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  }

  if (typeof document === "undefined") return null;

  const expandedRect = {
    top: OUTER_MARGIN,
    left: OUTER_MARGIN,
    width: viewport.width - OUTER_MARGIN * 2,
    height: viewport.height - OUTER_MARGIN * 2,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        key="map"
        role="dialog"
        aria-modal="true"
        aria-label={dict.common.radarMapAria}
        className="fixed z-50 overflow-hidden border border-white/15 bg-[#e5e3df] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        initial={{ ...anchorRect, borderRadius: 22 }}
        animate={{ ...expandedRect, borderRadius: 28 }}
        exit={{ ...anchorRect, borderRadius: 22 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        {/* Interactive map viewport with touch drag navigation */}
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none select-none overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {visibleTiles.map((tile) => {
            const leftOffset = (tile.x - xGlobal) * 256 + pan.x;
            const topOffset = (tile.y - yGlobal) * 256 + pan.y;
            const placement = radarOverlayPlacement(tile);
            const radarUrl = activeFrame
              ? rainViewerTileUrl(host, activeFrame.path, placement.parentTile)
              : null;

            return (
              <div
                key={`${tile.z}-${tile.x}-${tile.y}`}
                className="absolute pointer-events-none"
                style={{
                  left: `calc(50% + ${leftOffset}px)`,
                  top: `calc(50% + ${topOffset}px)`,
                  width: 256,
                  height: 256,
                }}
              >
                <BaseMapTile tile={tile} className="absolute inset-0 h-full w-full" />
                {radarUrl ? (
                  <div
                    className="absolute inset-0 opacity-85 pointer-events-none"
                    style={{
                      backgroundImage: `url(${radarUrl})`,
                      backgroundSize: `${placement.sizePercent}% ${placement.sizePercent}%`,
                      backgroundPosition: `${placement.positionXPercent}% ${placement.positionYPercent}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                ) : null}
              </div>
            );
          })}

          {/* District focal drop pin */}
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]"
            style={{
              left: `calc(50% + ${pan.x}px)`,
              top: `calc(50% + ${pan.y}px)`,
            }}
          >
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" aria-hidden="true">
              <path
                d="M16 0C7.16 0 0 7.16 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16 24.84 0 16 0Z"
                fill="#E8A838"
              />
              <path
                d="M16 1.5C8 1.5 1.5 8 1.5 16C1.5 27.2 16 40.2 16 40.2C16 40.2 30.5 27.2 30.5 16C30.5 8 24 1.5 16 1.5Z"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="2"
              />
              <circle cx="16" cy="15" r="5.5" fill="#FFFFFF" />
            </svg>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={uiLanguage === "lg" ? dict.common.close : "Close map"}
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[rgba(20,25,45,0.85)] text-white/85 backdrop-blur-xl hover:bg-[rgba(20,25,45,0.95)]"
        >
          ✕
        </button>

        {/* Zoom controls */}
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleZoomChange(Math.max(MIN_ZOOM, zoom - 1))}
            disabled={zoom <= MIN_ZOOM}
            aria-label={r.zoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[rgba(20,25,45,0.85)] text-[18px] text-white/85 backdrop-blur-xl disabled:opacity-40"
          >
            -
          </button>
          <span className="min-w-8 text-center text-[12px] font-medium text-white/80 bg-[rgba(20,25,45,0.85)] px-2 py-1 rounded-full border border-white/15">
            z{zoom}
          </span>
          <button
            type="button"
            onClick={() => handleZoomChange(Math.min(MAX_ZOOM, zoom + 1))}
            disabled={zoom >= MAX_ZOOM}
            aria-label={r.zoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[rgba(20,25,45,0.85)] text-[18px] text-white/85 backdrop-blur-xl disabled:opacity-40"
          >
            +
          </button>
        </div>

        {/* Precipitation legend card */}
        <div className="absolute left-4 top-16 z-20 w-52 rounded-2xl border border-white/15 bg-[rgba(20,25,45,0.9)] p-4 backdrop-blur-xl">
          <p className="text-[14px] font-semibold text-white">{dict.sheets.feelsLike.precipitationRow}</p>
          <p className="mt-1 text-[12px] font-medium text-white/85">
            {weather.precipitation.mm > 0
              ? formatDistrictPhrase(
                  r.rainDetected.replace("{mm}", String(weather.precipitation.mm)),
                  weather.district.name,
                  dict,
                  uiLanguage,
                )
              : formatDistrictPhrase(r.noRainDetected, weather.district.name, dict, uiLanguage)}
          </p>
          <div className="mt-3 space-y-2 text-[13px] text-white/80">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffe066]" />
              {r.legendExtreme}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-caution" />
              {r.legendHeavy}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5ac8fa]" />
              {r.legendModerate}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1B8A7A]" />
              {r.legendLight}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
            {r.legendNote}
          </p>
        </div>

        {/* Timeline bottom bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12">
          <p className="text-[15px] font-medium text-white">
            {loading
              ? r.loadingRadar
              : error
                ? r.radarUnavailable
                : activeFrame
                    ? (isNowcast ? r.forecastAt : r.radarAt).replace(
                        "{time}",
                        formatFrameTime(activeFrame.time, uiLanguage),
                      )
                  : r.noRadarFrames}
          </p>
          <p className="mt-0.5 text-[13px] text-white/60">
            {localizeDistrictName(weather.district.name, dict)}, {coords.lat.toFixed(2)}°, {coords.lon.toFixed(2)}°
          </p>

          {frames.length > 1 && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] text-white/85 hover:bg-white/15"
              >
                {playing ? r.pause : r.play}
              </button>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={frameIndex}
                onChange={(event) => setFrameIndex(Number(event.target.value))}
                className="w-full accent-white"
                aria-label={r.radarTimeline}
              />
            </div>
          )}

          {error && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] text-white/85 hover:bg-white/15"
            >
              {r.retryRadar}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

