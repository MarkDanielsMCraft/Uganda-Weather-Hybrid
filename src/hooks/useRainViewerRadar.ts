"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  exactPositionInGrid,
  radarOverlayPlacement,
  rainViewerTileUrl,
  tileGrid,
  type MapTile,
} from "@/lib/geo/tile";

export interface RadarFrame {
  time: number;
  path: string;
}

interface RainViewerPayload {
  host?: string;
  radar?: {
    past?: RadarFrame[];
    nowcast?: RadarFrame[];
  };
}

interface RadarFramesResult {
  host: string;
  frames: RadarFrame[];
  pastCount: number;
}

async function fetchRadarFrames(): Promise<RadarFramesResult> {
  const response = await fetch("/api/v1/radar/frames");
  if (!response.ok) throw new Error("Radar API failed");

  const payload = (await response.json()) as { data: RainViewerPayload };
  const data = payload.data;
  const host = data.host || "https://tilecache.rainviewer.com";
  const past = data.radar?.past ?? [];
  const nowcast = data.radar?.nowcast ?? [];

  return {
    host,
    frames: [...past, ...nowcast],
    pastCount: past.length,
  };
}

/** `radius` controls how many tiles out from centre are fetched (radius 1
    = the 3x3 mosaic MapView/the detail sheet's radar use; radius 0 = a
    single centre tile, for compact tile-face previews). The marker
    position is computed relative to that same span — passing a mismatched
    radius between what's rendered and what the marker was computed for is
    exactly the bug that used to place the pin nowhere near the real
    location on the single-tile preview: a percentage meant to describe
    where a point falls within a 3-tile-wide mosaic was being applied
    directly to a box a third that width. */
const EMPTY_FRAMES: RadarFrame[] = [];

export function useRainViewerRadar(lat: number, lon: number, zoom = 6, radius = 1) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const { tiles } = tileGrid(lat, lon, zoom, radius);
  const markerPosition = exactPositionInGrid(lat, lon, zoom, radius);

  const framesQuery = useQuery({
    queryKey: ["radar", "frames"],
    queryFn: fetchRadarFrames,
    staleTime: 2 * 60 * 1000,
    // Matches the server's own cache window for radar frames (5 minutes),
    // so the map picks up new precipitation frames on its own while open.
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const host = framesQuery.data?.host ?? "https://tilecache.rainviewer.com";
  const frames = framesQuery.data?.frames ?? EMPTY_FRAMES;
  const pastCount = framesQuery.data?.pastCount ?? 0;

  useEffect(() => {
    if (!framesQuery.data) return;
    setFrameIndex(Math.max(0, pastCount - 1));
  }, [framesQuery.dataUpdatedAt, pastCount, framesQuery.data]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 700);
    return () => window.clearInterval(timer);
  }, [frames, playing]);

  const activeFrame = frames[frameIndex];

  function tileUrls(framePath: string | undefined) {
    return tiles.map((tile: MapTile) => {
      const placement = radarOverlayPlacement(tile);
      return {
        tile,
        radar: framePath ? rainViewerTileUrl(host, framePath, placement.parentTile) : null,
        radarSizePercent: placement.sizePercent,
        radarPositionXPercent: placement.positionXPercent,
        radarPositionYPercent: placement.positionYPercent,
      };
    });
  }

  const layerTiles = tileUrls(activeFrame?.path);

  return {
    layerTiles,
    markerPosition,
    frames,
    frameIndex,
    activeFrame,
    pastCount,
    loading: framesQuery.isPending,
    error: framesQuery.isError,
    playing,
    setFrameIndex,
    setPlaying,
    togglePlay: () => setPlaying((value) => !value),
    refetch: () => framesQuery.refetch(),
  };
}
