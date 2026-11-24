import { bearerTokenMatches } from "@/lib/api/bearer-secret";
import { getDistrictBySlug } from "@/lib/districts";
import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { dispatchStormAlert } from "@/lib/push/dispatch";
import { pushDispatchSchema } from "@/lib/validation/schemas";

function authorizeDispatch(request: Request, dryRun = false) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development" && dryRun;
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return bearerTokenMatches(header.slice("Bearer ".length), secret);
}

export async function POST(request: Request) {
  // With a secret set, check it before reading the body, so callers without
  // it learn nothing about what the route expects.
  if (process.env.PUSH_DISPATCH_SECRET && !authorizeDispatch(request, false)) {
    return errorResponse("UNAUTHORIZED", "Invalid dispatch credentials", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = pushDispatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid storm alert payload", 400);
  }

  if (!authorizeDispatch(request, parsed.data.dryRun)) {
    return errorResponse("UNAUTHORIZED", "Invalid dispatch credentials", 401);
  }

  const district = getDistrictBySlug(parsed.data.districtSlug);
  if (!district) {
    return errorResponse("NOT_FOUND", `District '${parsed.data.districtSlug}' not found`, 404);
  }

  const result = await dispatchStormAlert(
    {
      districtSlug: district.slug,
      title: parsed.data.title,
      body: parsed.data.body,
      route: parsed.data.route,
    },
    { dryRun: parsed.data.dryRun },
  );

  const meta = createMeta(false);
  return jsonResponse(result, meta);
}
