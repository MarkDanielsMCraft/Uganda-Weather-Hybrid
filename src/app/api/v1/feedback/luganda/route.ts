import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { mergeRateLimitHeaders, rejectCrossSiteRequest } from "@/lib/api/route-utils";
import {
  logBlockedFeedbackAction,
  submitLugandaFeedback,
  verifyTurnstileToken,
} from "@/lib/feedback/luganda-feedback";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "@/lib/rate-limit";
import { lugandaFeedbackSchema } from "@/lib/validation/schemas";

const FEEDBACK_RATE_LIMIT = 10;
const FEEDBACK_WINDOW_MS = 60_000;
const FEEDBACK_DAILY_LIMIT = 200;
const FEEDBACK_DAILY_LIMIT_PER_ADDRESS = 5;

export async function POST(request: Request) {
  const crossSite = rejectCrossSiteRequest(request, "feedback");
  if (crossSite) return crossSite;

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

  // Each report becomes an email. If the human check is not set up, or a
  // script gets past it, this caps how many reach the inbox in one day.
  const perAddress = checkRateLimit(`feedback:luganda:day:${ip}`, FEEDBACK_DAILY_LIMIT_PER_ADDRESS, 24 * 60 * 60 * 1000);
  if (!perAddress.allowed) {
    logBlockedFeedbackAction("submit", "DAILY_LIMIT_ADDRESS");
    return errorResponse("RATE_LIMITED", "Too many feedback submissions today", 429, {
      resetAt: perAddress.resetAt,
    });
  }

  const daily = checkRateLimit("feedback:luganda:all", FEEDBACK_DAILY_LIMIT, 24 * 60 * 60 * 1000);
  if (!daily.allowed) {
    logBlockedFeedbackAction("submit", "DAILY_LIMIT");
    return errorResponse("RATE_LIMITED", "Too many feedback submissions today", 429, {
      resetAt: daily.resetAt,
    });
  }

  const result = await submitLugandaFeedback(parsed.data);

  // Never say thank you for a report nobody will read. If it was neither
  // emailed nor saved, the form shows its "could not send" message instead.
  if (!result.emailed && !result.persisted) {
    logBlockedFeedbackAction("submit", "NO_DELIVERY", result.reportId);
    return errorResponse("SERVICE_UNAVAILABLE", "Feedback cannot be delivered right now", 503);
  }

  return jsonResponse(
    {
      accepted: result.accepted,
      reportId: result.reportId,
    },
    createMeta(false),
    mergeRateLimitHeaders({ status: 201 }, rateLimitHeaders(limitResult)),
  );
}
