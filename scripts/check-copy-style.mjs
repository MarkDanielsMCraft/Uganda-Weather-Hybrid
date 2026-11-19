#!/usr/bin/env node
// Guard: user-facing copy must not contain em dashes, en dashes, arrows, or
// decorative symbols/emoji. See AGENTS.md copy style. Scans string literals in
// app and component source only (comments and technical identifiers elsewhere
// are out of scope).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SCAN = /^src\/(app|components)\/.*\.(ts|tsx)$/;

const FORBIDDEN = [
  { re: /—/, label: "em dash — use a comma, colon, or two sentences" },
  { re: /–/, label: "en dash — use the word 'to' for ranges" },
  { re: /[←→⇐⇒⬅➡]/, label: "arrow character — write 'to'" },
  { re: /[✓✗★☆⚠✅❌🚨⏳🎉🔥👍💡➡⬅]/u, label: "decorative symbol or emoji" },
];

// Single-line string / template literals (skips comments and JSX text).
function stringLiterals(content) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const value = m[2];
    if (value.length >= 2 && !value.includes("\n")) out.push(value);
  }
  return out;
}

const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => SCAN.test(f));

const violations = [];
for (const file of files) {
  for (const value of stringLiterals(readFileSync(file, "utf8"))) {
    for (const { re, label } of FORBIDDEN) {
      if (re.test(value)) {
        violations.push(`${file} [${label}]: ${JSON.stringify(value.slice(0, 100))}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`check:copy FAILED — ${violations.length} copy-style violation(s) (AGENTS.md copy style):`);
  for (const v of violations.slice(0, 40)) console.error("  " + v);
  if (violations.length > 40) console.error(`  ... and ${violations.length - 40} more`);
  process.exit(1);
}
console.log(`check:copy OK — scanned string literals in ${files.length} app/component files.`);
