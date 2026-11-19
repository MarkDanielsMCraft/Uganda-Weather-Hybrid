#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const forceLive = process.argv.includes("--live");
const liveEnabled = process.env.PUSH_DISPATCH_LIVE === "1";
const dryRun = forceLive && liveEnabled ? "0" : "1";
const secret = process.env.CRON_SECRET ?? "";

const headers = secret ? { Authorization: `Bearer ${secret}` } : {};

const response = await fetch(
  `${BASE_URL}/api/v1/cron/dispatch-alerts?dryRun=${dryRun}`,
  { headers },
);

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Alert dispatch cron failed: HTTP ${response.status}`, body?.error?.message ?? body);
  process.exit(1);
}

const data = body.data ?? body;
if (forceLive && !liveEnabled) {
  console.warn("PUSH_DISPATCH_LIVE is not set. Dispatch ran in dry-run mode.");
}
console.log(
  `Alert dispatch dryRun=${data.dryRun}: scanned=${data.scannedDistricts} sent=${data.dispatched?.length ?? 0}`,
);
