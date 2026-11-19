import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { fetchMetar } from "@/lib/weather/metar";
import { AIRPORTS } from "@/lib/places/points-of-interest";

// Real METARs update roughly hourly or on significant change; this TTL
// just protects against rapid repeat opens of the Airport Weather sheet.
const METAR_TTL_SECONDS = 600;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  try {
    const { data, stale } = await getCached("metar:uganda:v1", METAR_TTL_SECONDS, () =>
      fetchMetar(AIRPORTS.map((airport) => airport.icao)),
    );

    const meta = createMeta(stale);
    return jsonResponse(
      { reports: data },
      meta,
      mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
    );
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Airport weather temporarily unavailable", 503);
  }
}
