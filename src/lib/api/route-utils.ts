import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createMeta, errorResponse } from "@/lib/cache";

/** Requests allowed per minute, per route, per IP address. Ugandan mobile
    networks put many customers behind one shared public address, so a low,
    shared limit would block whole neighbourhoods at once. Weather responses
    are cached, so a higher limit does not multiply calls to the providers. */
const DEFAULT_API_RATE_LIMIT_PER_MINUTE = 240;

function readApiRateLimit(): number {
  const parsed = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  return Number.isInteger(parsed) && parsed >= 30 && parsed <= 5_000
    ? parsed
    : DEFAULT_API_RATE_LIMIT_PER_MINUTE;
}

/** One counting bucket per route, never per address typed. District detail
    pages share one bucket, so changing the name in the address cannot reset
    the count, and the number of keys stays small. Only the first four path
    parts are used for the same reason. */
function routeKey(request: Request): string {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
  const parts = pathname.split("/").filter(Boolean).slice(0, 4);
  if (parts[2] === "districts" && parts[3] && parts[3] !== "search") parts[3] = ":slug";
  return `/${parts.join("/")}`.replace(/[^\w/.:-]/g, "").slice(0, 80);
}

export function enforceRateLimit(request: Request) {
  const ip = clientIpFromRequest(request);
  const result = checkRateLimit(`api:${routeKey(request)}:${ip}`, readApiRateLimit());

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

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Refuses POST requests that a browser marks as coming from another site, so
    other websites cannot spend this app's paid voice and AI quota through our
    routes. Browsers set Sec-Fetch-Site and Origin themselves and pages cannot
    change them. A script outside a browser can still fake both, which is why
    the per IP rate limits stay in place behind this check. */
export function rejectCrossSiteRequest(request: Request, component: string): Response | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "same-site") return null;

  if (!fetchSite) {
    const originHost = hostOf(request.headers.get("origin"));
    // The real Host header comes first. X-Forwarded-Host is only a fallback,
    // because a client can send its own copy of it.
    const requestHost = (
      request.headers.get("host") ?? request.headers.get("x-forwarded-host") ?? ""
    )
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    if (originHost && requestHost && originHost === requestHost) return null;
  }

  const safeComponent = component.replace(/[^\w:.-]/g, "");
  const safeSite = (fetchSite ?? "missing").replace(/[^\w:.-]/g, "");
  console.warn(`[${safeComponent}] action blocked action=post code=CROSS_SITE site=${safeSite}`);
  return errorResponse("FORBIDDEN", "This request must come from the Uganda Weather app.", 403);
}
