import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { mergeRateLimitHeaders } from "@/lib/api/route-utils";
import {
  logBlockedFeedbackAction,
  submitLugandaFeedback,
  verifyTurnstileToken,
} from "@/lib/feedback/luganda-feedback";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { lugandaFeedbackSchema } from "@/lib/validation/schemas";

const FEEDBACK_RATE_LIMIT = 10;
const FEEDBACK_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limitResult = checkRateLimit(
    `feedback:luganda:${ip}`,
    FEEDBACK_RATE_LIMIT,
    FEEDBACK_WINDOW_MS,
  );
  if (!limitResult.allowed) {
    logBlockedFeedbackAction("submit", "RATE_LIMITED");
    return errorResponse("RATE_LIMITED", "Too many feedback submissions", 429, {
      resetAt: limitResult.resetAt,
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    logBlockedFeedbackAction("submit", "INVALID_JSON");
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = lugandaFeedbackSchema.safeParse(rawBody);
  if (!parsed.success) {
    logBlockedFeedbackAction("submit", "VALIDATION_FAILED");
    return errorResponse("BAD_REQUEST", "Invalid feedback submission", 400);
  }

  // Honeypot trap: silently accept without storing or emailing when filled by bots.
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    logBlockedFeedbackAction("submit", "HONEYPOT_TRIGGERED");
    return jsonResponse(
      { accepted: true, reportId: "ignored" },
      createMeta(false),
      mergeRateLimitHeaders({ status: 200 }, rateLimitHeaders(limitResult)),
    );
  }

  const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!turnstileOk) {
    logBlockedFeedbackAction("submit", "TURNSTILE_FAILED");
    return errorResponse("FORBIDDEN", "Security verification failed", 403);
  }

  const result = await submitLugandaFeedback(parsed.data);

  return jsonResponse(
    {
      accepted: result.accepted,
      reportId: result.reportId,
    },
    createMeta(false),
    mergeRateLimitHeaders({ status: 201 }, rateLimitHeaders(limitResult)),
  );
}
