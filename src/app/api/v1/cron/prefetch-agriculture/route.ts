import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { cronPrefetchQuerySchema } from "@/lib/validation/schemas";
import { prefetchDistrictAgriculture } from "@/lib/agriculture/prefetch";

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
    concurrency: searchParams.get("concurrency") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid cron query parameters", 400);
  }

  const result = await prefetchDistrictAgriculture(undefined, parsed.data.concurrency);

  const meta = createMeta(false);
  return jsonResponse(result, meta);
}
