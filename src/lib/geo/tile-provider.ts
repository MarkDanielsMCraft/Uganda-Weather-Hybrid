import type { MapTile } from "./tile";

/** OpenStreetMap data rendered for clear weather navigation.
    
    Uganda Weather uses high-clarity OpenStreetMap tiles matching standard
    cartographic styling:
    1. MapTiler (primary, if NEXT_PUBLIC_MAPTILER_API_KEY is configured)
    2. Stadia Maps OSM Bright (secondary, if NEXT_PUBLIC_STADIA_MAPS_API_KEY is configured)
    3. OpenStreetMap standard tiles (direct high-clarity baseline)
    4. OpenStreetMap France Humanitarian (resilient global fallback) */

export function maptilerTileUrl(tile: MapTile): string | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  if (!key) return null;
  return `https://api.maptiler.com/maps/openstreetmap/${tile.z}/${tile.x}/${tile.y}.png?key=${key}`;
}

export function stadiaTileUrl(tile: MapTile): string | null {
  const key = process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY;
  if (!key) return null;
  return `https://tiles.stadiamaps.com/tiles/osm_bright/${tile.z}/${tile.x}/${tile.y}.png?api_key=${key}`;
}

export function openstreetmapTileUrl(tile: MapTile): string {
  return `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
}

export function openstreetmapHotTileUrl(tile: MapTile): string {
  const subdomains = ["a", "b", "c"];
  const sub = subdomains[Math.abs(tile.x + tile.y) % subdomains.length];
  return `https://${sub}.tile.openstreetmap.fr/hot/${tile.z}/${tile.x}/${tile.y}.png`;
}

/** Ordered candidate list for a tile: MapTiler and Stadia first when keys
    are present, followed by high-clarity OpenStreetMap standard and HOT
    tiles. */
export function baseTileCandidates(tile: MapTile): string[] {
  return [
    maptilerTileUrl(tile),
    stadiaTileUrl(tile),
    openstreetmapTileUrl(tile),
    openstreetmapHotTileUrl(tile),
  ].filter((url): url is string => Boolean(url));
}

