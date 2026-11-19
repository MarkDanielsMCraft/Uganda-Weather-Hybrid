/** Lets a deep link (e.g. landing on /forecast directly) find and scroll
    to a specific tile rendered somewhere inside the home screen's tile
    grid, without either side needing to know about the other's tree
    position. Tiles mark themselves with a `data-tile-id` attribute (see
    HomeTileGrid) rather than registering through an imperative API — a
    plain DOM query needs no mount/unmount bookkeeping, and a lookup miss
    (the tile hasn't rendered yet) is a normal, expected outcome, not an
    error. */

export function findTileElement(tileId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`);
}
