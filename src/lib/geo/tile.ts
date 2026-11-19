export function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y, z: zoom };
}

export interface MapTile {
  x: number;
  y: number;
  z: number;
}

/** Computes continuous (floating point) tile coordinates at zoom level. */
export function exactTileCoordinates(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const xGlobal = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yGlobal = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { xGlobal, yGlobal };
}

export function tileGrid(lat: number, lon: number, zoom: number, radius = 1) {
  const center = latLonToTile(lat, lon, zoom);
  const tiles: MapTile[] = [];

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      tiles.push({ x: center.x + dx, y: center.y + dy, z: zoom });
    }
  }

  return { center, tiles };
}

/** The marker in MapView/PrecipitationMapWidget used to sit dead centre of
    the tile mosaic regardless of where the exact coordinates actually fall
    within that tile — at country-scale zoom that was invisible, but at the
    district/city zoom this app now uses, a real place can be anywhere
    within a tile that spans several kilometres, so the pin needs to move
    within the grid to reflect that, not always sit at the exact middle. */
export function exactPositionInGrid(lat: number, lon: number, zoom: number, radius = 1) {
  const n = 2 ** zoom;
  const xFrac = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFrac = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const center = latLonToTile(lat, lon, zoom);
  const offsetX = xFrac - center.x;
  const offsetY = yFrac - center.y;
  const span = radius * 2 + 1;

  return {
    leftPercent: ((radius + offsetX) / span) * 100,
    topPercent: ((radius + offsetY) / span) * 100,
  };
}

export function rainViewerTileUrl(host: string, framePath: string, tile: MapTile) {
  return `${host}${framePath}/256/${tile.z}/${tile.x}/${tile.y}/4/1_1.png`;
}

/** Verified by direct probe against RainViewer's tile server: zoom 7
    returns real tile data (blank/transparent where there's no rain), but
    zoom 8 and above return the exact same "Zoom Level Not Supported"
    placeholder image regardless of x/y. The OSM base map can still zoom
    in to district/city level (z10+) for real street detail — only the
    radar overlay needs to stay capped here and be cropped per-tile to
    align with the finer base-map grid. */
export const RADAR_MAX_ZOOM = 7;

export interface RadarOverlayPlacement {
  parentTile: MapTile;
  sizePercent: number;
  positionXPercent: number;
  positionYPercent: number;
}

/** Maps a (possibly finer-zoom) base-map tile down to the RainViewer tile
    that actually covers it, plus the CSS background-size/-position needed
    to crop just that tile's slice out of the coarser radar image. */
export function radarOverlayPlacement(
  tile: MapTile,
  radarZoom = RADAR_MAX_ZOOM,
): RadarOverlayPlacement {
  const zoomDrop = Math.max(0, tile.z - radarZoom);
  const scale = 2 ** zoomDrop;
  const parentTile: MapTile = {
    x: tile.x >> zoomDrop,
    y: tile.y >> zoomDrop,
    z: tile.z - zoomDrop,
  };
  const offsetX = tile.x - (parentTile.x << zoomDrop);
  const offsetY = tile.y - (parentTile.y << zoomDrop);

  return {
    parentTile,
    sizePercent: scale * 100,
    positionXPercent: scale > 1 ? (offsetX / (scale - 1)) * 100 : 0,
    positionYPercent: scale > 1 ? (offsetY / (scale - 1)) * 100 : 0,
  };
}
