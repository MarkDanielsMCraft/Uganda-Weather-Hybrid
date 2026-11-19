import { getAllDistricts } from "@/lib/districts";
import { createMeta, jsonResponse } from "@/lib/cache/memory";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { regionQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = regionQuerySchema.safeParse({
    region: searchParams.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Invalid region" }, meta: createMeta() },
      { status: 400 },
    );
  }

  const districts = getAllDistricts(parsed.data.region);

  return jsonResponse(
    {
      districts: districts.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        region: d.region,
        coordinates: d.coordinates,
        agroZone: d.agroZone,
        isCity: d.isCity ?? false,
      })),
      total: districts.length,
    },
    createMeta(),
    mergeRateLimitHeaders(undefined, rateLimit.headers),
  );
}
