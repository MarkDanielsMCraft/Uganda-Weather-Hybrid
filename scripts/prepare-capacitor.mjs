#!/usr/bin/env node

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const requestedPlatform = process.argv[2];

if (requestedPlatform && !["ios", "android"].includes(requestedPlatform)) {
  console.error("Pass either 'ios' or 'android' when adding a native platform.");
  process.exit(1);
}

if (!serverUrl) {
  console.error(
    "Set CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL before preparing native shells.",
  );
  console.error("Example: CAPACITOR_SERVER_URL=https://www.uganda-weather.com pnpm cap:prepare");
  process.exit(1);
}

let parsedServerUrl;
try {
  parsedServerUrl = new URL(serverUrl);
} catch {
  console.error("CAPACITOR_SERVER_URL must be a valid HTTPS URL.");
  process.exit(1);
}

const isLocalhost = ["localhost", "127.0.0.1", "10.0.2.2"].includes(parsedServerUrl.hostname);
if (parsedServerUrl.protocol !== "https:" && !isLocalhost) {
  console.error("CAPACITOR_SERVER_URL must use HTTPS (except for local development on localhost/10.0.2.2).");
  process.exit(1);
}

process.env.CAPACITOR_SERVER_URL = parsedServerUrl.origin;
console.log(`Capacitor server URL: ${parsedServerUrl.origin}`);

function checkCocoaPods() {
  try {
    execSync("which pod", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!existsSync("ios")) {
  if (checkCocoaPods()) {
    console.log("CocoaPods found. Run: pnpm cap:add:ios");
  } else {
    console.log("Install CocoaPods first: brew install cocoapods");
    console.log("Then run: pnpm cap:add:ios");
  }
}

if (!existsSync("android")) {
  console.log("No android/ folder yet. Run: pnpm cap:add:android");
}
const capBin = existsSync("node_modules/.bin/cap") ? "./node_modules/.bin/cap" : "npx cap";
if (requestedPlatform && !existsSync(requestedPlatform)) {
  if (requestedPlatform === "ios" && !checkCocoaPods()) {
    console.error("CocoaPods is required to add and sync the iOS project.");
    process.exit(1);
  }
  execSync(`${capBin} add ${requestedPlatform}`, { stdio: "inherit" });
}
execSync(`${capBin} sync`, { stdio: "inherit" });

if (existsSync("scripts/generate-native-assets.py")) {
  try {
    execSync("python3 scripts/generate-native-assets.py", { stdio: "inherit" });
  } catch (err) {
    console.warn("Asset generation skipped or failed:", err.message);
  }
}

console.log("Capacitor sync and asset generation complete.");
