#!/usr/bin/env node
// Guard: required documentation must exist and be substantive, and the
// changelog must stay in a shape a release can be cut from. See AGENTS.md
// documentation and release.
//
// A byte count alone is not enough. CHANGELOG.md passed this check on all 27
// commits it went unrecorded for, because a stale file is the same size as a
// current one. What can be checked without guessing at intent is the shape:
// somewhere to record new work, dates on releases, newest first, and a version
// that agrees with package.json. That last one is what actually catches a
// forgotten release, since the bump and the entry are two halves of the same
// act.
import { existsSync, readFileSync, statSync } from "node:fs";
import { validateChangelog } from "./changelog.mjs";

const REQUIRED = [
  ["README.md", 400],
  ["SECURITY.md", 200],
  ["CHANGELOG.md", 200],
];

const problems = [];
for (const [file, minBytes] of REQUIRED) {
  if (!existsSync(file)) {
    problems.push(`missing required doc: ${file}`);
    continue;
  }
  const { size } = statSync(file);
  if (size < minBytes) {
    problems.push(`${file} is too small (${size} bytes < ${minBytes}) — document it properly.`);
  }
}

if (existsSync("CHANGELOG.md")) {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  problems.push(...validateChangelog(readFileSync("CHANGELOG.md", "utf8"), version));
}

if (problems.length) {
  console.error("check:docs FAILED (AGENTS.md documentation):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check:docs OK — required docs present, and the changelog is releasable.");
