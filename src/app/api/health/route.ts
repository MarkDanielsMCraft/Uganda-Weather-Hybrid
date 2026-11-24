import { getAllDistricts } from "@/lib/districts";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

/** Public and cheap. It says the app is up and nothing more, because a list
    of which services and keys are set up helps an attacker plan. */
export async function GET() {
  return Response.json({
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    districts: getAllDistricts().length,
  });
}
