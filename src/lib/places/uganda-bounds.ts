// Uganda's bounding box, matching the coordinate validation in
// src/lib/validation/schemas.ts. A GPS fix outside this box can't be served
// by the weather APIs (they reject out-of-range coordinates), so callers use
// this to reject a foreign fix before it becomes a broken "place" that fails
// every forecast lookup.
export const UGANDA_BOUNDS = { minLat: -4, maxLat: 5, minLon: 29, maxLon: 36 } as const;

export function isWithinUganda(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= UGANDA_BOUNDS.minLat &&
    lat <= UGANDA_BOUNDS.maxLat &&
    lon >= UGANDA_BOUNDS.minLon &&
    lon <= UGANDA_BOUNDS.maxLon
  );
}
