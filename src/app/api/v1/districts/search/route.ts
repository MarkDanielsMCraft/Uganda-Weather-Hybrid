import { searchDistricts } from "@/lib/districts";
import { createMeta, jsonResponse, errorResponse } from "@/lib/cache/memory";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { searchQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Query must be at least 2 characters", 400);
  }

  const results = searchDistricts(parsed.data.q);

  return jsonResponse({ results }, createMeta(), mergeRateLimitHeaders(undefined, rateLimit.headers));
}
