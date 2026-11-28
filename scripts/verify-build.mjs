#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const cssDir = join(process.cwd(), ".next", "static", "css");
const chunksDir = join(process.cwd(), ".next", "static", "chunks");
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

// Guard older Safari / WebKit devices (such as iPhone 7 on iOS 15.8) against
// regex lookbehinds (?<= or (?<!) in client JS bundles, which throw SyntaxError.
function collectJsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const lookbehindRe = /\(\?<[=!]/;
const offendingChunks = [];
for (const jsFile of collectJsFiles(chunksDir)) {
  const content = readFileSync(jsFile, "utf8");
  if (lookbehindRe.test(content)) {
    offendingChunks.push(relative(process.cwd(), jsFile));
  }
}
if (offendingChunks.length > 0) {
  fail(
    `Client JS bundle contains regex lookbehind (?<= or (?<!) incompatible with iOS 15 Safari: ${offendingChunks.join(", ")}`,
  );
}

console.log(
  `[verify-build] OK — ${cssFiles.length} CSS file(s), ${Math.round(totalBytes / 1024)} KB total, 0 iOS 15 incompatible lookbehind regexes.`,
);
