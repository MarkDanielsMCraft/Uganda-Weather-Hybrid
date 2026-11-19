#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has("--check-config");
const forceClean = args.has("--force-clean") || process.env.UW_DEV_CLEAN === "1";

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, ".next");

const REQUIRED = [
  "postcss.config.mjs",
  "src/app/globals.css",
  "src/app/layout.tsx",
];

function fail(message) {
  console.error(`\n[ensure-dev] ${message}\n`);
  process.exit(1);
}

function info(message) {
  console.log(`[ensure-dev] ${message}`);
}

for (const file of REQUIRED) {
  if (!existsSync(join(ROOT, file))) {
    fail(`Missing required file: ${file}`);
  }
}

function nextLooksCorrupt() {
  if (!existsSync(NEXT_DIR)) return false;

  const serverDir = join(NEXT_DIR, "server");
  const manifest = join(serverDir, "app-paths-manifest.json");
  const buildId = join(NEXT_DIR, "BUILD_ID");

  if (existsSync(serverDir) && !existsSync(manifest)) {
    return true;
  }

  if (existsSync(buildId)) {
    const cssDir = join(NEXT_DIR, "static", "css");
    if (existsSync(cssDir)) {
      const cssFiles = readdirSync(cssDir).filter((name) => name.endsWith(".css"));
      if (cssFiles.length === 0) {
        return true;
      }
    }

    const clientChunksDir = join(NEXT_DIR, "static", "chunks");
    if (existsSync(clientChunksDir)) {
      const chunkFiles = new Set(readdirSync(clientChunksDir));
      const pageChunk = chunkFiles.has("app/(main)/page.js")
        ? "app/(main)/page.js"
        : [...chunkFiles].find((name) => name.includes("page.js") && name.includes("main"));
      if (!pageChunk) {
        return true;
      }
    }
  }

  const webpackRuntime = join(serverDir, "webpack-runtime.js");
  if (existsSync(webpackRuntime)) {
    try {
      const runtime = readFileSync(webpackRuntime, "utf8");
      const chunkRefs = runtime.match(/\.\/\d+\.js/g) ?? [];
      for (const ref of chunkRefs.slice(0, 12)) {
        const chunkName = ref.replace("./", "");
        if (!existsSync(join(serverDir, chunkName))) {
          return true;
        }
      }
    } catch {
      return true;
    }
  }

  return false;
}

function cleanNext(reason) {
  info(reason);
  rmSync(NEXT_DIR, { recursive: true, force: true });
  info("Removed .next cache.");
}

if (checkConfigOnly) {
  info("Style config OK.");
  process.exit(0);
}

if (forceClean && existsSync(NEXT_DIR)) {
  cleanNext("UW_DEV_CLEAN requested.");
}

if (nextLooksCorrupt()) {
  cleanNext("Corrupted .next cache detected.");
}

info("Ready to start.");
