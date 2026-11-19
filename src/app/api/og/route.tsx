import { ImageResponse } from "next/og";
import {
  BRAND_CREAM,
  BRAND_GREEN,
  CLOUD_BACK_LOBES,
  CLOUD_BODY,
  CLOUD_FRONT_LOBES,
  CLOUD_SHADE,
  MARK_COLORS,
  MARK_GRADIENTS,
  RAIN_LINES,
  SUN_CIRCLE,
  SUN_RAYS,
  UGANDA_OUTLINE_PATH,
  WEATHER_PLACEMENT,
} from "@/lib/design/brand-mark";

export const runtime = "edge";

const INK = "#1a1524";
/** The card is rasterised without a stylesheet, so it reads the mark's
    literals rather than the theme tokens. */
const ACCENT = BRAND_GREEN;
const CREAM = BRAND_CREAM;
const MARK_SIZE = 200;

function clampText(value: string | null, fallback: string, maxLength: number) {
  const text = (value ?? "").trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Shared OpenGraph image for every shareable link, so a district page, a
    lake page, and the home page each render a distinct, branded preview
    card instead of every shared link looking identical. Query params
    carry the page specific title and subtitle; callers set
    `openGraph.images` in their own `generateMetadata` to point here. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = clampText(searchParams.get("title"), "Uganda Weather", 60);
  const subtitle = clampText(
    searchParams.get("subtitle"),
    "District level weather for all of Uganda",
    90,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: INK,
          backgroundImage: `linear-gradient(155deg, rgba(47,125,95,0.20) 0%, rgba(26,21,36,0) 48%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 512 512">
            <defs>
              {MARK_GRADIENTS.map((gradient) =>
                gradient.kind === "radial" ? (
                  <radialGradient
                    key={gradient.id}
                    id={gradient.id}
                    cx={gradient.cx}
                    cy={gradient.cy}
                    r={gradient.r}
                  >
                    {gradient.stops.map((stop) => (
                      <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                    ))}
                  </radialGradient>
                ) : (
                  <linearGradient
                    key={gradient.id}
                    id={gradient.id}
                    x1={gradient.x1}
                    y1={gradient.y1}
                    x2={gradient.x2}
                    y2={gradient.y2}
                  >
                    {gradient.stops.map((stop) => (
                      <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                    ))}
                  </linearGradient>
                ),
              )}
            </defs>
            <path d={UGANDA_OUTLINE_PATH} fill={ACCENT} />
            <g transform={WEATHER_PLACEMENT}>
              <circle {...SUN_CIRCLE} fill="url(#uwSun)" />
              {SUN_RAYS.map((ray) => (
                <line
                  key={`${ray.x1}-${ray.y1}`}
                  x1={ray.x1}
                  y1={ray.y1}
                  x2={ray.x2}
                  y2={ray.y2}
                  stroke={MARK_COLORS.sunRay}
                  strokeWidth={ray.width}
                  strokeLinecap="round"
                />
              ))}
              {CLOUD_BACK_LOBES.map((lobe) => (
                <circle key={`${lobe.cx}-${lobe.cy}`} {...lobe} fill={CLOUD_SHADE} />
              ))}
              <rect {...CLOUD_BODY} fill="url(#uwCloud)" />
              {CLOUD_FRONT_LOBES.map((lobe) => (
                <circle key={`${lobe.cx}-${lobe.cy}`} {...lobe} fill="url(#uwCloud)" />
              ))}
              {RAIN_LINES.map((line) => (
                <line
                  key={`${line.x1}-${line.y1}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="url(#uwRain)"
                  strokeWidth={line.width}
                  strokeLinecap="round"
                />
              ))}
            </g>
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: "44px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            Uganda Weather
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "76px",
              fontWeight: 700,
              lineHeight: 1.05,
              color: CREAM,
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 400,
              color: "rgba(247,244,239,0.72)",
              maxWidth: "980px",
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
