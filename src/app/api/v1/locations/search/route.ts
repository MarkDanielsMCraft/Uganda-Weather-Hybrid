import { searchLocations } from "@/lib/places/search";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { searchQuerySchema } from "@/lib/validation/schemas";

/** Place lookups can reach the free map service, which blocks apps that ask
    too often, so this route allows far fewer requests than the others. */
const PLACE_LOOKUP_RATE_LIMIT_PER_MINUTE = 60;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, PLACE_LOOKUP_RATE_LIMIT_PER_MINUTE);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Search query must be at least 2 characters", 400);
  }

  try {
    const results = await searchLocations(parsed.data.q);
    const meta = createMeta(false);

    return jsonResponse({ results }, meta, mergeRateLimitHeaders({}, rateLimit.headers));
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Search temporarily unavailable", 503);
  }
}
