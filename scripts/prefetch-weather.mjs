#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const mode = process.argv.includes("--all") ? "all" : "priority";
const offset = Number(process.env.PREFETCH_OFFSET ?? 0);
const limit = Number(process.env.PREFETCH_LIMIT ?? 50);
const secret = process.env.CRON_SECRET ?? "";

const params = new URLSearchParams({ mode });
if (mode === "all") {
  params.set("offset", String(offset));
  params.set("limit", String(limit));
}

const headers = secret ? { Authorization: `Bearer ${secret}` } : {};

const response = await fetch(`${BASE_URL}/api/v1/cron/prefetch-weather?${params}`, {
  headers,
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Prefetch failed: HTTP ${response.status}`, body?.error?.message ?? body);
  process.exit(1);
}

const data = body.data ?? body;
console.log(
  `Prefetch ${mode}: requested=${data.requested} refreshed=${data.refreshed} cached=${data.cached} errors=${data.errors?.length ?? 0}`,
);

if ((data.errors?.length ?? 0) > 0) {
  for (const item of data.errors) {
    console.error(`  ${item.slug}: ${item.error}`);
  }
  process.exit(1);
}
