#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FEED_URL =
  process.env.UNMA_ALERTS_URL ?? "https://cap-sources.s3.amazonaws.com/ug-dms-en/rss.xml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../data/fixtures/unma-cap-sample.xml");

async function checkFeed() {
  const response = await fetch(FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`UNMA CAP feed HTTP ${response.status}`);
  }

  const xml = await response.text();
  if (!xml.includes("<rss") && !xml.includes("<feed")) {
    throw new Error("UNMA CAP feed did not return RSS/XML");
  }

  const itemCount = (xml.match(/<item[\s\S]*?<\/item>/gi) ?? []).length;
  console.log(`UNMA CAP feed reachable (${itemCount} active items)`);
}

function checkFixture() {
  const xml = readFileSync(fixturePath, "utf8");
  if (!xml.includes("Heavy Rain Warning")) {
    throw new Error("CAP fixture missing sample headline");
  }
  if (!xml.includes("<areaDesc>Kampala, Wakiso</areaDesc>")) {
    throw new Error("CAP fixture missing sample area");
  }
  console.log("CAP fixture present");
}

async function main() {
  checkFixture();
  await checkFeed();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
