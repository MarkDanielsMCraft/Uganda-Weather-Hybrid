#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const districtSlug = process.argv[2] ?? "kampala";
const title = process.argv[3] ?? "Storm watch";
const body = process.argv[4] ?? `Weather alert for ${districtSlug}. Open Uganda Weather for details.`;
const dryRun = process.argv.includes("--dry-run") || !process.env.PUSH_DISPATCH_SECRET;

async function main() {
  const headers = { "Content-Type": "application/json" };
  if (process.env.PUSH_DISPATCH_SECRET) {
    headers.Authorization = `Bearer ${process.env.PUSH_DISPATCH_SECRET}`;
  }

  const response = await fetch(`${BASE_URL}/api/v1/push/dispatch`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      districtSlug,
      title,
      body,
      dryRun,
      route: "/alerts",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error(`Dispatch failed (${response.status}):`, payload);
    process.exit(1);
  }

  console.log(JSON.stringify(payload.data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
