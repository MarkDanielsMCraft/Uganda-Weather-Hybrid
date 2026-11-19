import { createMeta, errorResponse, jsonResponse } from "@/lib/cache";
import { dispatchPendingSevereAlerts } from "@/lib/push/alert-dispatch";

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
  const liveEnabled = process.env.PUSH_DISPATCH_LIVE === "1";
  const forceDryRun =
    searchParams.get("dryRun") === "1" || searchParams.get("dryRun") === "true";
  const dryRun = forceDryRun || !liveEnabled;

  const result = await dispatchPendingSevereAlerts({ dryRun });
  const meta = createMeta(false);

  return jsonResponse(
    {
      dryRun,
      ...result,
    },
    meta,
  );
}
