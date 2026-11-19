import { WEATHER_PALETTE } from "@/lib/design/weather-palette";

/**
 * The Uganda Weather mark: a sun and a rain cloud over the country's
 * outline, with rain falling across the land.
 *
 * The country is traced from real boundary data and stays a clean solid
 * silhouette. The weather symbol in front of it is deliberately illustrated
 * rather than diagrammatic: a warm disc behind a cloud built from
 * overlapping lobes, with thick rounded rays and rain strokes. Colours carry
 * meaning rather than decoration: the land is the brand green, and the sun
 * and the rain take the forecast colours they have everywhere else.
 *
 * This module is the single definition of the mark. The header glyph, the
 * OpenGraph card and the static icon files all derive from it, and
 * `brand-mark.test.ts` fails the build if a static file drifts from these
 * values.
 */

/** Brand green as a literal.
 *
 *  Everything that can read a CSS custom property should use
 *  `--color-brand-green` instead. Icons cannot: a `.svg` file served
 *  straight from disk has no stylesheet, and the OpenGraph image is
 *  rasterised without one. Those surfaces read this constant, and the test
 *  asserts it still matches the token declared in `globals.css`. */
export const BRAND_GREEN = "#0D903B";

/** Brand cream, the same value `--text-primary` carries. */
export const BRAND_CREAM = "#F7F4EF";

export const MARK_COLORS = {
  land: BRAND_GREEN,
  sun: WEATHER_PALETTE.sun.fill,
  /** Rays take the deeper gold, so the disc reads against its own spokes
      instead of the two merging into one flat shape. */
  sunRay: WEATHER_PALETTE.sun.ray,
  cloud: WEATHER_PALETTE.cloud.white,
  rain: WEATHER_PALETTE.rain.drop,
} as const;

/**
 * Uganda's national outline, traced from the Natural Earth 1:10m admin-0
 * boundary (public domain) rather than drawn by hand. Earlier passes at
 * this were typed from memory and kept getting the country wrong in ways
 * that were obvious side by side: no Lake Albert notch on the west, no
 * West Nile lobe, the wrong south-east corner.
 *
 * The 607 source vertices are reduced to 80 by Ramer-Douglas-Peucker,
 * which drops the coastline wiggle a 16px icon cannot show while keeping
 * every corner, then each junction gets a small fillet. Equirectangular
 * projection: Uganda straddles the equator, so a degree of longitude and a
 * degree of latitude are the same length here to within 0.03 percent.
 *
 * Regenerate with scripts/build-uganda-outline.mjs.
 */
export const UGANDA_OUTLINE_PATH =
  "M95.5 461.6Q92.5 461.6 90.8 464.1L78.4 482.6Q76.7 485.0 74.1 486.6L61.7 494.3Q59.1 495.9 56.7 495.0L56.7 495.0Q54.2 494.2 53.0 491.4L50.6 485.9Q49.4 483.2 46.5 484.0L31.7 488.0Q28.8 488.7 28.5 485.8L26.3 459.1Q26.0 456.2 27.3 453.4L30.2 447.2Q31.5 444.5 31.8 441.5L38.8 368.5Q39.1 365.5 40.6 362.9L42.4 359.7Q43.9 357.1 45.4 357.5L45.4 357.5Q47.0 357.8 47.6 354.9L49.9 344.4Q50.6 341.5 52.4 339.0L57.3 332.1Q59.1 329.6 59.2 326.6L59.6 305.2Q59.7 302.2 62.5 301.1L74.5 296.2Q77.3 295.1 78.3 292.2L83.2 278.8Q84.3 276.0 87.0 274.8L101.8 268.5Q104.6 267.3 106.4 264.9L119.8 247.6Q121.6 245.3 123.9 243.4L148.4 223.7Q150.7 221.8 152.5 219.4L169.5 196.8Q171.4 194.5 170.1 191.7L164.7 180.4Q163.5 177.7 160.5 177.9L156.1 178.4Q153.1 178.7 151.3 176.3L147.7 171.4Q145.9 169.0 143.5 170.8L140.1 173.3Q137.7 175.1 136.0 172.6L133.0 168.4Q131.3 166.0 128.4 165.3L126.6 164.9Q123.7 164.1 124.8 161.3L135.1 134.1Q136.2 131.3 134.9 128.6L128.4 115.0Q127.1 112.3 128.4 109.7L139.6 88.4Q141.0 85.7 140.7 82.7L140.1 78.0Q139.8 75.1 137.4 76.3L137.4 76.3Q134.9 77.5 136.4 74.9L142.3 64.2Q143.7 61.5 146.5 60.4L163.7 53.2Q166.5 52.0 169.2 53.2L189.8 62.3Q192.6 63.5 195.4 62.6L203.4 59.8Q206.2 58.8 208.2 56.6L212.1 52.2Q214.1 50.0 216.3 52.0L222.2 57.5Q224.4 59.5 225.2 62.4L226.1 65.5Q226.9 68.4 229.7 69.4L244.1 74.6Q246.9 75.6 247.4 72.7L247.9 69.6Q248.4 66.7 251.0 65.1L261.6 58.8Q264.2 57.3 267.2 57.0L293.4 54.3Q296.4 54.0 299.1 52.7L314.0 45.5Q316.7 44.2 319.1 45.9L328.5 52.8Q330.9 54.6 333.9 54.7L355.2 55.6Q358.2 55.7 360.4 53.6L397.0 18.1Q399.2 16.0 400.6 16.6L400.6 16.6Q401.9 17.3 403.1 20.1L409.3 35.1Q410.4 37.9 409.6 40.8L409.2 42.0Q408.3 44.9 411.3 45.0L415.6 45.1Q418.6 45.2 417.2 47.8L415.5 50.8Q414.1 53.4 417.1 53.2L418.7 53.1Q421.7 52.9 423.0 55.5L423.4 56.3Q424.7 59.0 427.1 58.0L427.1 58.0Q429.5 57.0 432.1 58.6L435.8 60.9Q438.3 62.5 438.3 65.5L438.1 71.5Q438.0 74.5 435.8 76.5L435.7 76.6Q433.5 78.6 434.0 81.6L437.2 100.6Q437.7 103.5 440.3 105.1L443.7 107.3Q446.2 108.9 447.3 111.7L453.3 127.1Q454.4 129.8 457.3 130.5L460.6 131.3Q463.5 132.0 464.4 134.8L469.3 149.9Q470.2 152.8 472.6 153.0L472.6 153.0Q475.1 153.3 476.0 156.2L478.0 162.0Q479.0 164.9 477.6 167.5L475.6 171.2Q474.1 173.8 475.1 176.7L485.0 207.3Q486.0 210.1 485.6 213.1L483.6 229.3Q483.2 232.3 481.5 234.7L468.6 252.2Q466.9 254.6 467.2 257.6L468.0 264.9Q468.4 267.9 465.7 269.2L445.0 279.1Q442.3 280.4 441.3 283.2L435.1 300.1Q434.1 302.9 431.8 304.9L416.0 318.8Q413.8 320.8 413.1 323.7L409.3 339.5Q408.6 342.5 406.7 344.8L394.1 360.1Q392.2 362.4 393.0 365.3L396.6 378.5Q397.4 381.4 397.2 384.4L393.3 453.2Q393.1 456.2 390.1 456.1L132.8 454.7Q129.8 454.7 127.2 456.3L120.5 460.5Q118.0 462.1 115.0 462.0Z";

/**
 * The weather symbol: a golden sun behind a puffy shaded cloud, with rounded
 * drops beneath. Authored on a 100 unit grid and placed on the country by a
 * single transform.
 *
 * This part of the mark is deliberately dimensional rather than flat. The
 * cloud takes its volume from unequal overlapping lobes and a crown-to-
 * underside gradient, the sun from a radial that warms toward its rim, and
 * the drops from a light-to-deep blue. The country behind it stays flat and
 * solid; the contrast between the two is the point.
 *
 * Everything is still sized for the small end, since the mark has to hold at
 * 16px: bold silhouettes, round ends and wide spacing, with the shading as
 * something that enriches the large sizes rather than something the small
 * ones depend on.
 */

type GradientStop = { offset: number; color: string };

export type MarkGradient =
  | { id: string; kind: "radial"; cx: string; cy: string; r: string; stops: GradientStop[] }
  | {
      id: string;
      kind: "linear";
      x1: string;
      y1: string;
      x2: string;
      y2: string;
      stops: GradientStop[];
    };

/** Declared once and rendered into every surface, so the header glyph, the
    icon files and the share card cannot drift apart. */
export const MARK_GRADIENTS: MarkGradient[] = [
  {
    id: "uwSun",
    kind: "radial",
    cx: "38%",
    cy: "34%",
    r: "72%",
    stops: [
      { offset: 0, color: WEATHER_PALETTE.sun.core },
      { offset: 0.55, color: WEATHER_PALETTE.sun.fill },
      { offset: 1, color: WEATHER_PALETTE.sun.ray },
    ],
  },
  {
    id: "uwCloud",
    kind: "linear",
    x1: "0",
    y1: "0",
    x2: "0.25",
    y2: "1",
    stops: [
      { offset: 0, color: WEATHER_PALETTE.cloud.white },
      { offset: 0.55, color: "#EEF4F9" },
      { offset: 1, color: "#CFDCE7" },
    ],
  },
  {
    id: "uwRain",
    kind: "linear",
    x1: "0",
    y1: "0",
    x2: "0.3",
    y2: "1",
    stops: [
      { offset: 0, color: "#8FDCFF" },
      { offset: 1, color: "#3FB2E5" },
    ],
  },
];

export const SUN_CIRCLE = { cx: 31, cy: 27, r: 17 } as const;

/** Uneven angles, lengths and weights. Equal spokes read as a diagram; the
    reference's rays are hand placed. Only the arc the cloud leaves exposed
    carries any. */
export const SUN_RAYS = [
  { degrees: 154, inner: 21.5, length: 10.5, width: 6.6 },
  { degrees: 194, inner: 21, length: 12.5, width: 7.2 },
  { degrees: 231, inner: 21.5, length: 9, width: 6 },
  { degrees: 269, inner: 21, length: 12, width: 7 },
  { degrees: 307, inner: 21.5, length: 10, width: 6.3 },
  { degrees: 343, inner: 21, length: 8.5, width: 6.8 },
].map(({ degrees, inner, length, width }) => {
  const angle = (degrees * Math.PI) / 180;
  const at = (radius: number) => ({
    x: Number((SUN_CIRCLE.cx + Math.cos(angle) * radius).toFixed(2)),
    y: Number((SUN_CIRCLE.cy + Math.sin(angle) * radius).toFixed(2)),
  });
  const from = at(inner);
  const to = at(inner + length);
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, width };
});

/** The shade the puffs behind the body take. Kept close to the crown white:
    pushed any darker they stop reading as puffs behind the cloud and start
    reading as grey discs beside it. The meteorological palette has no tint
    between its white and its grey, so this is the mark's own value and the
    only colour here not straight from the palette. */
export const CLOUD_SHADE = "#DEE9F1";

export const CLOUD_BACK_LOBES = [
  { cx: 42, cy: 41, r: 11.5 },
  { cx: 63, cy: 35, r: 13 },
  { cx: 79, cy: 46, r: 9 },
] as const;

/** The base runs wider than the crown, which is what gives a cloud its
    bottom-heavy silhouette. */
export const CLOUD_BODY = { x: 22, y: 56, width: 71, height: 18, rx: 9 } as const;

/** Radii deliberately unequal and off centre. A row of same-sized circles is
    what makes a cloud look generic. */
export const CLOUD_FRONT_LOBES = [
  { cx: 33, cy: 57, r: 16.5 },
  { cx: 50, cy: 46, r: 20 },
  { cx: 69, cy: 42, r: 16 },
  { cx: 83, cy: 55, r: 14.5 },
  { cx: 92, cy: 64, r: 9.5 },
  { cx: 25, cy: 66, r: 10.5 },
] as const;

/** Unequal weight, length and lean, and widely spaced so they stay four
    separate drops at 24px rather than merging into one blue smear. */
export const RAIN_LINES = [
  { x1: 37, y1: 80, x2: 31, y2: 95, width: 8.4 },
  { x1: 56, y1: 77, x2: 50, y2: 94, width: 7 },
  { x1: 75, y1: 79, x2: 69, y2: 96, width: 8.8 },
  { x1: 90, y1: 83, x2: 86, y2: 94, width: 6.4 },
] as const;

export const WEATHER_PLACEMENT = "translate(66 34) scale(2.75)";

function gradientMarkup(indent: string): string {
  return MARK_GRADIENTS.map((gradient) => {
    const stops = gradient.stops
      .map((stop) => `${indent}    <stop offset="${stop.offset}" stop-color="${stop.color}"/>`)
      .join("\n");
    const open =
      gradient.kind === "radial"
        ? `<radialGradient id="${gradient.id}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}">`
        : `<linearGradient id="${gradient.id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">`;
    const close = gradient.kind === "radial" ? "</radialGradient>" : "</linearGradient>";
    return `${indent}  ${open}\n${stops}\n${indent}  ${close}`;
  }).join("\n");
}

/** Plum tile behind the maskable Android icon. The mark itself has no
    background; this exists only because a maskable icon is cropped to the
    launcher's shape and must paint to its own edges. */
export const MASKABLE_BACKGROUND = "#1a1524";

function markBody(indent: string): string {
  const inner = `${indent}  `;
  const circles = (lobes: ReadonlyArray<{ cx: number; cy: number; r: number }>) =>
    lobes.map((lobe) => `${inner}  <circle cx="${lobe.cx}" cy="${lobe.cy}" r="${lobe.r}"/>`).join("\n");
  const strokes = (
    items: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number; width: number }>,
  ) =>
    items
      .map(
        (item) =>
          `${inner}  <line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke-width="${item.width}"/>`,
      )
      .join("\n");
  const body = CLOUD_BODY;

  return [
    `${indent}<path d="${UGANDA_OUTLINE_PATH}" fill="${MARK_COLORS.land}"/>`,
    `${indent}<g transform="${WEATHER_PLACEMENT}">`,
    `${inner}<circle cx="${SUN_CIRCLE.cx}" cy="${SUN_CIRCLE.cy}" r="${SUN_CIRCLE.r}" fill="url(#uwSun)"/>`,
    `${inner}<g stroke="${MARK_COLORS.sunRay}" stroke-linecap="round">`,
    strokes(SUN_RAYS),
    `${inner}</g>`,
    `${inner}<g fill="${CLOUD_SHADE}">`,
    circles(CLOUD_BACK_LOBES),
    `${inner}</g>`,
    `${inner}<g fill="url(#uwCloud)">`,
    `${inner}  <rect x="${body.x}" y="${body.y}" width="${body.width}" height="${body.height}" rx="${body.rx}"/>`,
    circles(CLOUD_FRONT_LOBES),
    `${inner}</g>`,
    `${inner}<g stroke="url(#uwRain)" stroke-linecap="round">`,
    strokes(RAIN_LINES),
    `${inner}</g>`,
    `${indent}</g>`,
  ].join("\n");
}

/**
 * The mark as a standalone SVG document, for the files that are served
 * from disk. `scale` shrinks the mark inside the viewBox so a maskable
 * icon keeps its safe zone; `background` paints a tile behind it.
 */
export function renderMarkSvg({
  background,
  scale = 1,
}: { background?: string; scale?: number } = {}): string {
  const tile = background
    ? `\n  <rect width="512" height="512" rx="115" fill="${background}"/>`
    : "";
  const offset = Number(((512 * (1 - scale)) / 2).toFixed(2));
  const open = scale === 1 ? "" : `\n  <g transform="translate(${offset} ${offset}) scale(${scale})">`;
  const close = scale === 1 ? "" : `\n  </g>`;
  const indent = scale === 1 ? "  " : "    ";

  const defs = `\n  <defs>\n${gradientMarkup("  ")}\n  </defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">${defs}${tile}${open}\n${markBody(indent)}${close}\n</svg>\n`;
}
