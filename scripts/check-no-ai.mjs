#!/usr/bin/env node
// Guard: no AI-tool attribution anywhere in the repo. Every commit, doc, and
// comment must read as our own work. See AGENTS.md section 1.
//
// Matches attribution *patterns* (not bare tool names) so ordinary prose that
// happens to mention a tool is not flagged. AGENTS.md and this script are
// exempt because they document the forbidden patterns.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const IGNORE = new Set(["AGENTS.md", "scripts/check-no-ai.mjs"]);
const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx|json|css|scss|yml|yaml|html)$/;

const PATTERNS = [
  /co-?authored-by:\s*(claude|cursor|copilot|chatgpt|openai|anthropic|gpt-|codex|v0)\b/i,
  /generated\s+(with|by)\s+\[?(claude|cursor|copilot|chatgpt|codex|v0|anthropic)/i,
  /claude\.ai\/code/i,
  /cursor\.com\/(agents|background-agent)/i,
  /\bClaude-Session\b/i,
  /🤖\s*generated/i,
  // Competitor brand imitation & copying patterns (AGENTS.md section 1)
  /\b(apple\s+weather|pixel\s+weather|sf\s+symbols|material\s+bento)\b/i,
  /\b(borrow(ed|ing)?|copied|imitat(ed|ing)?)\s+(from\s+)?(apple|google)\b/i,
  /\b(like\s+apple|like\s+google)\b/i,
  /\b(apple's\s+technique|apple's\s+pattern|apple's\s+ephemeris|google's\s+lesson)\b/i,
];

const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter(
    (f) =>
      SCAN_EXT.test(f) &&
      !IGNORE.has(f) &&
      !f.endsWith("-lock.yaml") &&
      !f.endsWith("lock.json"),
  );

const violations = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const re of PATTERNS) {
      if (re.test(line)) {
        violations.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
        break;
      }
    }
  });
}

if (violations.length) {
  console.error("check:no-ai FAILED — AI attribution or competitor brand imitation found (AGENTS.md section 1):");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log(`check:no-ai OK — scanned ${files.length} files, no AI attribution or competitor imitation.`);
