#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? "";

const headers = secret ? { Authorization: `Bearer ${secret}` } : {};

const response = await fetch(`${BASE_URL}/api/v1/cron/prefetch-air-quality`, { headers });

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Air quality prefetch failed: HTTP ${response.status}`, body?.error?.message ?? body);
  process.exit(1);
}

const data = body.data ?? body;
console.log(
  `Air quality prefetch: requested=${data.requested} refreshed=${data.refreshed} cached=${data.cached} errors=${data.errors?.length ?? 0}`,
);

if ((data.errors?.length ?? 0) > 0) {
  for (const item of data.errors) {
    console.error(`  ${item.slug}: ${item.error}`);
  }
  process.exit(1);
}
