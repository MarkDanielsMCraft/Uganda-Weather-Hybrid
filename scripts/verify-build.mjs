#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cssDir = join(process.cwd(), ".next", "static", "css");
const buildIdPath = join(process.cwd(), ".next", "BUILD_ID");

function fail(message) {
  console.error(`\n[verify-build] ${message}\n`);
  process.exit(1);
}

if (!existsSync(buildIdPath)) {
  fail("Missing .next/BUILD_ID. Run npm run build first.");
}

if (!existsSync(cssDir)) {
  fail("Missing .next/static/css. Tailwind CSS did not compile.");
}

const cssFiles = readdirSync(cssDir).filter((name) => name.endsWith(".css"));
if (cssFiles.length === 0) {
  fail("No CSS files in .next/static/css.");
}

const totalBytes = cssFiles.reduce((sum, name) => {
  return sum + statSync(join(cssDir, name)).size;
}, 0);

if (totalBytes < 2048) {
  fail(`CSS bundle too small (${totalBytes} bytes). Styles may not have compiled.`);
}

console.log(
  `[verify-build] OK — ${cssFiles.length} CSS file(s), ${Math.round(totalBytes / 1024)} KB total.`,
);
