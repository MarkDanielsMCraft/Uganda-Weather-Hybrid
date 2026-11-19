import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createMeta, errorResponse } from "@/lib/cache";

export function enforceRateLimit(request: Request) {
  const ip = clientIpFromRequest(request);
  const result = checkRateLimit(`api:${ip}`);

  if (!result.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      resetAt: result.resetAt,
    });
  }

  return { headers: rateLimitHeaders(result) };
}

export function mergeRateLimitHeaders(
  init: ResponseInit | undefined,
  rateHeaders: Record<string, string>,
): ResponseInit {
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...rateHeaders,
    },
  };
}

export { createMeta };
