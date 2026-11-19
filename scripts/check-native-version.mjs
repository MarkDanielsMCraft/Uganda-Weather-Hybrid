#!/usr/bin/env node
// Guard: the iOS app and its widget must carry the same version as package.json.
//
// Android reads its version from package.json at build time, but Xcode keeps the
// version typed into the project file for every target and build setting. A
// release that bumps package.json and forgets Xcode ships an iOS build with the
// old version, which App Store Connect then refuses as a duplicate. The app and
// its widget extension must also share one build number, or App Store Connect
// flags the extension as not matching its app.
import { readFileSync } from "node:fs";

const PROJECT_FILE = "ios/App/App.xcodeproj/project.pbxproj";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const project = readFileSync(PROJECT_FILE, "utf8");

const marketing = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim());
const builds = [...project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1].trim());

const problems = [];
if (marketing.length === 0) {
  problems.push(`no MARKETING_VERSION found in ${PROJECT_FILE}`);
}
for (const value of new Set(marketing)) {
  if (value !== version) {
    problems.push(`${PROJECT_FILE} has MARKETING_VERSION ${value}, but package.json is ${version}`);
  }
}
if (new Set(builds).size > 1) {
  problems.push(
    `${PROJECT_FILE} has different CURRENT_PROJECT_VERSION values (${[...new Set(builds)].join(", ")}); the app and widget must match`,
  );
}

if (problems.length > 0) {
  console.error("Native version check failed:");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("Fix the Xcode project versions listed above before releasing.");
  process.exit(1);
}

console.log(`Native version check passed (iOS ${version}, build ${builds[0] ?? "unset"}).`);
