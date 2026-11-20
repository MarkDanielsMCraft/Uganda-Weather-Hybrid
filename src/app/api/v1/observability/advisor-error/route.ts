import { z } from "zod";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";

const OBSERVABILITY_RATE_LIMIT = 10;
const OBSERVABILITY_WINDOW_MS = 60_000;

const safeToken = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[\w/:.-]+$/);

const advisorErrorPayloadSchema = z.object({
  code: safeToken(64),
  district: safeToken(64),
  online: z.boolean(),
  appCheckActive: z.boolean(),
  model: safeToken(64),
});

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(
    `observability:advisor-error:${ip}`,
    OBSERVABILITY_RATE_LIMIT,
    OBSERVABILITY_WINDOW_MS,
  );
  if (!limitResult.allowed) {
    console.warn("[ai-advisor] action blocked action=report_error code=RATE_LIMITED");
    return errorResponse("RATE_LIMITED", "Too many error reports", 429, {
      resetAt: limitResult.resetAt,
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    console.warn("[ai-advisor] action blocked action=report_error code=INVALID_JSON");
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = advisorErrorPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.warn("[ai-advisor] action blocked action=report_error code=VALIDATION_FAILED");
    return errorResponse("BAD_REQUEST", "Invalid error report payload", 400);
  }

  const { code, district, online, appCheckActive, model } = parsed.data;
  console.error(
    `[ai-advisor] client failure action=generate code=${code} district=${district} online=${String(online)} appCheck=${String(appCheckActive)} model=${model}`,
  );

  return jsonResponse(
    { recorded: true },
    createMeta(false),
    mergeRateLimitHeaders(
      { status: 202, headers: { "Cache-Control": "no-store" } },
      rateLimitHeaders(limitResult),
    ),
  );
}
