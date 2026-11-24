import { getDistrictBySlug } from "@/lib/districts";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders, rejectCrossSiteRequest } from "@/lib/api/route-utils";
import { isPushStoreFull, removePushToken, savePushToken } from "@/lib/push/store";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { pushRegisterSchema, pushUnregisterSchema } from "@/lib/validation/schemas";

const PUSH_SIGNUPS_PER_HOUR = 10;

export async function POST(request: Request) {
  const crossSite = rejectCrossSiteRequest(request, "push");
  if (crossSite) return crossSite;

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

  // A phone signs up once, and again only when its district changes, so a
  // handful an hour from one address is plenty for a whole household.
  const hourly = checkRateLimit(
    `push:register:${clientIpFromRequest(request)}`,
    PUSH_SIGNUPS_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!hourly.allowed) {
    console.warn("[push] action blocked action=register code=HOURLY_LIMIT");
    return errorResponse("RATE_LIMITED", "Too many alert sign ups", 429, { resetAt: hourly.resetAt });
  }

  if (await isPushStoreFull(parsed.data.token)) {
    console.warn("[push] action blocked action=register code=STORE_FULL");
    return errorResponse("SERVICE_UNAVAILABLE", "Alert sign ups are paused", 503);
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
  const crossSite = rejectCrossSiteRequest(request, "push");
  if (crossSite) return crossSite;

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
