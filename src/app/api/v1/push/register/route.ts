import { getDistrictBySlug } from "@/lib/districts";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { removePushToken, savePushToken } from "@/lib/push/store";
import { pushRegisterSchema, pushUnregisterSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = pushRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid push registration payload", 400);
  }

  const district = getDistrictBySlug(parsed.data.districtSlug);
  if (!district) {
    return errorResponse("NOT_FOUND", `District '${parsed.data.districtSlug}' not found`, 404);
  }

  if (parsed.data.platform === "web") {
    return errorResponse("BAD_REQUEST", "Web push is not supported yet", 400);
  }

  const { persisted, record } = await savePushToken({
    token: parsed.data.token,
    platform: parsed.data.platform,
    districtSlug: district.slug,
    language: parsed.data.language,
  });

  const meta = createMeta(false);

  return jsonResponse(
    {
      accepted: true,
      persisted,
      district: {
        slug: district.slug,
        name: district.name,
      },
      platform: parsed.data.platform,
      registeredAt: record.updatedAt,
    },
    meta,
    mergeRateLimitHeaders({}, rateLimit.headers),
  );
}

export async function DELETE(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = pushUnregisterSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid push unregister payload", 400);
  }

  const { removed, persisted } = await removePushToken(parsed.data.token);
  const meta = createMeta(false);

  return jsonResponse(
    {
      removed,
      persisted,
    },
    meta,
    mergeRateLimitHeaders({}, rateLimit.headers),
  );
}
