import { getDistrictBySlug } from "@/lib/districts";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { districtSlugSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const rateLimit = enforceRateLimit(_request);
  if (rateLimit instanceof Response) return rateLimit;

  const { slug: rawSlug } = await context.params;
  const parsed = districtSlugSchema.safeParse(rawSlug?.trim().toLowerCase() ?? "");

  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid district slug", 400);
  }

  const district = getDistrictBySlug(parsed.data);
  if (!district) {
    return errorResponse("NOT_FOUND", `District '${parsed.data}' not found`, 404);
  }

  const meta = createMeta(false);
  return jsonResponse(
    {
      district: {
        id: district.id,
        name: district.name,
        slug: district.slug,
        region: district.region,
        coordinates: district.coordinates,
        rainfallPattern: district.rainfallPattern,
        agroZone: district.agroZone,
        hazards: district.hazards,
        isCity: district.isCity ?? false,
        popularRank: district.popularRank,
      },
    },
    meta,
    mergeRateLimitHeaders(undefined, rateLimit.headers),
  );
}
