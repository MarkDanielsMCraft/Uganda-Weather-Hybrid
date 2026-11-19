import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareVersions, parseChangelog, sectionFor, validateChangelog } from "./changelog.mjs";

const WELL_FORMED = `# Changelog

## [Unreleased]

## [1.1.0] - 2026-09-05

### Added

- A thing.

## [1.0.0] - 2026-07-10

- The first release.

[unreleased]: https://example.invalid/compare/v1.1.0...HEAD
[1.1.0]: https://example.invalid/compare/v1.0.0...v1.1.0
[1.0.0]: https://example.invalid/releases/tag/v1.0.0
`;

describe("validateChangelog", () => {
  it("accepts a well formed file", () => {
    expect(validateChangelog(WELL_FORMED, "1.1.0")).toEqual([]);
  });

  it("catches a release that was written but never bumped", () => {
    // The case this guard exists for. The changelog says 1.1.0 shipped and
    // package.json still says 1.0.0, so no tag can honestly name either.
    const problems = validateChangelog(WELL_FORMED, "1.0.0");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("package.json says 1.0.0");
  });

  it("requires somewhere to record new work", () => {
    const text = WELL_FORMED.replace("## [Unreleased]\n\n", "");
    expect(validateChangelog(text, "1.1.0")).toEqual([
      expect.stringContaining("no '## [Unreleased]' heading"),
    ]);
  });

  it("requires a date on every release", () => {
    const text = WELL_FORMED.replace("## [1.1.0] - 2026-09-05", "## [1.1.0]");
    expect(validateChangelog(text, "1.1.0")).toEqual([
      expect.stringContaining("[1.1.0] has no release date"),
    ]);
  });

  it("requires a link reference for every release", () => {
    const text = WELL_FORMED.replace("[1.1.0]: https://example.invalid/compare/v1.0.0...v1.1.0\n", "");
    expect(validateChangelog(text, "1.1.0")).toEqual([
      expect.stringContaining("[1.1.0] has no link reference definition"),
    ]);
  });

  it("requires the newest release first", () => {
    const text = `# Changelog

## [Unreleased]

## [1.0.0] - 2026-07-10

- The first release.

## [1.1.0] - 2026-09-05

- A thing.

[unreleased]: https://example.invalid/compare/v1.1.0...HEAD
[1.1.0]: https://example.invalid/compare/v1.0.0...v1.1.0
[1.0.0]: https://example.invalid/releases/tag/v1.0.0
`;
    expect(validateChangelog(text, "1.0.0")).toEqual([
      expect.stringContaining("[1.0.0] is listed above [1.1.0]"),
    ]);
  });

  it("rejects a heading that is not a semver version", () => {
    const text = WELL_FORMED.replace("## [1.1.0] - 2026-09-05", "## [next] - 2026-09-05");
    expect(validateChangelog(text, "1.0.0")).toEqual([
      expect.stringContaining("'next' is not a MAJOR.MINOR.PATCH version"),
    ]);
  });
});

describe("sectionFor", () => {
  it("returns one version's notes and nothing else", () => {
    expect(sectionFor(WELL_FORMED, "1.1.0")).toBe("### Added\n\n- A thing.");
  });

  it("accepts a tag name as well as a bare version", () => {
    expect(sectionFor(WELL_FORMED, "v1.1.0")).toBe(sectionFor(WELL_FORMED, "1.1.0"));
  });

  it("does not sweep the link definitions into the oldest entry", () => {
    // They sit at the foot of the file, after the last heading, so a naive
    // read to end-of-file would publish them as part of the release notes.
    expect(sectionFor(WELL_FORMED, "1.0.0")).toBe("- The first release.");
  });

  it("returns null for a version that was never released", () => {
    expect(sectionFor(WELL_FORMED, "9.9.9")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.1.1", "1.1.1")).toBe(0);
  });
});

describe("the real CHANGELOG.md", () => {
  it("is in a shape a release can be cut from", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    expect(validateChangelog(readFileSync("CHANGELOG.md", "utf8"), version)).toEqual([]);
  });

  it("has notes for the version package.json claims", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    expect(sectionFor(readFileSync("CHANGELOG.md", "utf8"), version)).toBeTruthy();
  });

  it("lists every released version in parseChangelog", () => {
    const { released, unreleased } = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
    expect(unreleased).not.toBeNull();
    expect(released.map((entry) => entry.version)).toEqual(["1.1.0", "1.0.0", "0.1.0"]);
  });
});
