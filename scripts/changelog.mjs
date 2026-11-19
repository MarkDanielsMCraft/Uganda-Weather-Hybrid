#!/usr/bin/env node
// Parses CHANGELOG.md. Shared by the check:docs guard, which validates the
// file's shape, and by the release workflow, which lifts one version's notes
// out of it to use as the GitHub release body. Both need the same idea of
// what a well formed entry looks like, so they read it from one place.
//
// Usage:
//   node scripts/changelog.mjs section 1.1.0   print that version's notes
//   node scripts/changelog.mjs latest          print the newest released version
import { readFileSync } from "node:fs";

const HEADING = /^## \[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseChangelog(text) {
  const lines = text.split("\n");
  const entries = [];
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
    const match = HEADING.exec(lines[i]);
    if (!match) {
      // Link reference definitions sit at the foot of the file, outside any
      // entry, so they are not part of the last entry's notes.
      if (current && !/^\[[^\]]+\]:\s/.test(lines[i])) current.body.push(lines[i]);
      continue;
    }
    current = { version: match[1], date: match[2] ?? null, line: i + 1, body: [] };
    entries.push(current);
  }

  const links = new Set();
  for (const line of lines) {
    const match = /^\[([^\]]+)\]:\s+\S+/.exec(line);
    if (match) links.add(match[1].toLowerCase());
  }

  return {
    entries,
    links,
    unreleased: entries.find((entry) => entry.version.toLowerCase() === "unreleased") ?? null,
    released: entries.filter((entry) => SEMVER.test(entry.version)),
  };
}

/** Compares two semver strings. Positive when `a` is newer than `b`. */
export function compareVersions(a, b) {
  const left = SEMVER.exec(a).slice(1).map(Number);
  const right = SEMVER.exec(b).slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/**
 * Everything the guard checks about the file's shape. Returned as a list of
 * problems rather than thrown, so check:docs can report all of them at once
 * alongside its own.
 */
export function validateChangelog(text, packageVersion) {
  const { entries, links, unreleased, released } = parseChangelog(text);
  const problems = [];

  if (!unreleased) {
    problems.push(
      "CHANGELOG.md has no '## [Unreleased]' heading. AGENTS.md requires new work to be recorded there.",
    );
  }

  for (const entry of entries) {
    if (entry === unreleased) continue;
    if (!SEMVER.test(entry.version)) {
      problems.push(`CHANGELOG.md line ${entry.line}: '${entry.version}' is not a MAJOR.MINOR.PATCH version.`);
      continue;
    }
    if (!entry.date) {
      problems.push(`CHANGELOG.md line ${entry.line}: [${entry.version}] has no release date. Use '## [x.y.z] - YYYY-MM-DD'.`);
    }
    if (!links.has(entry.version.toLowerCase())) {
      problems.push(`CHANGELOG.md: [${entry.version}] has no link reference definition at the foot of the file.`);
    }
  }

  for (let i = 1; i < released.length; i += 1) {
    if (compareVersions(released[i - 1].version, released[i].version) <= 0) {
      problems.push(
        `CHANGELOG.md: [${released[i - 1].version}] is listed above [${released[i].version}]. Newest version goes first.`,
      );
    }
  }

  // The bump and the entry are two halves of one release. Catching the pair
  // that drifted is the whole point: a version tag has to be able to name a
  // section, and the section has to describe what was tagged.
  const latest = released[0];
  if (latest && latest.version !== packageVersion) {
    problems.push(
      `CHANGELOG.md's newest release is [${latest.version}] but package.json says ${packageVersion}. Bump one to match the other.`,
    );
  }

  return problems;
}

export function sectionFor(text, version) {
  const wanted = version.replace(/^v/, "");
  const entry = parseChangelog(text).entries.find((candidate) => candidate.version === wanted);
  if (!entry) return null;
  return entry.body.join("\n").trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, argument] = process.argv.slice(2);
  const text = readFileSync("CHANGELOG.md", "utf8");

  if (command === "section") {
    if (!argument) {
      console.error("usage: node scripts/changelog.mjs section <version>");
      process.exit(2);
    }
    const body = sectionFor(text, argument);
    if (body === null) {
      console.error(`CHANGELOG.md has no entry for ${argument}.`);
      process.exit(1);
    }
    console.log(body);
  } else if (command === "latest") {
    const { released } = parseChangelog(text);
    if (!released.length) {
      console.error("CHANGELOG.md has no released versions.");
      process.exit(1);
    }
    console.log(released[0].version);
  } else {
    console.error("usage: node scripts/changelog.mjs <section|latest> [version]");
    process.exit(2);
  }
}
