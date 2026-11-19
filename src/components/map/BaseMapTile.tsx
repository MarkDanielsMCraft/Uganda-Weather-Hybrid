"use client";

import { useEffect, useMemo, useState } from "react";
import { baseTileCandidates } from "@/lib/geo/tile-provider";
import type { MapTile } from "@/lib/geo/tile";

/** Renders one base-map tile, trying candidates in order on a failed
    image load (MapTiler, Stadia, OpenStreetMap, OSM France). */
export function BaseMapTile({
  tile,
  className = "",
}: {
  tile: MapTile;
  className?: string;
}) {
  const candidates = useMemo(() => baseTileCandidates(tile), [tile]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [tile.x, tile.y, tile.z]);

  if (candidates.length === 0 || index >= candidates.length) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={candidates[index]}
      alt=""
      className={className}
      onError={() => setIndex((current) => current + 1)}
      loading="eager"
      decoding="async"
    />
  );
}

