import { resolvePlaceFromCoordinates } from "@/lib/places/resolve-place";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { reverseLocationQuerySchema } from "@/lib/validation/schemas";

/** Place lookups can reach the free map service, which blocks apps that ask
    too often, so this route allows far fewer requests than the others. */
const PLACE_LOOKUP_RATE_LIMIT_PER_MINUTE = 60;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, PLACE_LOOKUP_RATE_LIMIT_PER_MINUTE);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = reverseLocationQuerySchema.safeParse({
    lat: searchParams.get("lat") ?? "",
    lon: searchParams.get("lon") ?? "",
  });

  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid coordinates for reverse lookup", 400);
  }

  try {
    const place = await resolvePlaceFromCoordinates(parsed.data.lat, parsed.data.lon);
    const meta = createMeta(false);

    return jsonResponse({ place }, meta, mergeRateLimitHeaders({}, rateLimit.headers));
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Location lookup temporarily unavailable", 503);
  }
}
