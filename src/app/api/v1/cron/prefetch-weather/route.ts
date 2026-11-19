import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { cronPrefetchQuerySchema } from "@/lib/validation/schemas";
import { prefetchDistrictWeather, prefetchSlugsForMode } from "@/lib/weather/prefetch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return header.slice("Bearer ".length) === secret;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return errorResponse("UNAUTHORIZED", "Invalid cron credentials", 401);
  }

  const { searchParams } = new URL(request.url);
  const parsed = cronPrefetchQuerySchema.safeParse({
    mode: searchParams.get("mode") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    concurrency: searchParams.get("concurrency") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid cron query parameters", 400);
  }

  const { mode, offset, limit, concurrency } = parsed.data;
  const slugs = prefetchSlugsForMode(mode, offset, limit);
  const result = await prefetchDistrictWeather(slugs, concurrency);

  const meta = createMeta(false);
  return jsonResponse(
    {
      mode,
      offset: mode === "all" ? offset : 0,
      // For paginated "all" mode, report the requested page size (which
      // can differ from slugs.length on the last, partial page) rather
      // than collapsing both branches to the same value.
      limit: mode === "all" ? limit : slugs.length,
      ...result,
    },
    meta,
  );
}
