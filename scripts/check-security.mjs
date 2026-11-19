#!/usr/bin/env node
// Guard: baseline security and public-repo privacy posture. Verifies the
// deployed app declares real security headers, no secret-bearing files are
// tracked/stageable, and no local user paths or credentials leak into code.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const problems = [];

if (!existsSync("vercel.json")) {
  problems.push("vercel.json is missing — no security headers configured.");
} else {
  const vj = readFileSync("vercel.json", "utf8");
  for (const token of [
    "Content-Security-Policy",
    "frame-ancestors",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    if (!vj.includes(token)) problems.push(`vercel.json missing security header: ${token}`);
  }
}

const files = execSync("git ls-files --cached --others --exclude-standard", {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const FORBIDDEN_FILE_PATTERNS = [
  /^google-services\.json$/i,
  /^GoogleService-Info\.plist$/i,
  /\.(pem|key|p8|p12|jks|keystore|mobileprovision)$/i,
];

const CONTENT_GUARDS = [
  {
    label: "personal local machine path",
    rx: /((?<![A-Za-z0-9._@-])\/Users\/[A-Za-z0-9._-]+|(?<![A-Za-z0-9._@-])\/home\/[A-Za-z0-9._-]+|[A-Z]:\\Users\\[A-Za-z0-9._-]+)/,
  },
  {
    label: "Google or Firebase API key literal",
    rx: /\bAIza[0-9A-Za-z_-]{25,}\b/,
  },
  {
    label: "private key block",
    rx: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    label: "provider access token",
    rx: /\b(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|re_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
  },
];

const BINARY_EXT = /\.(png|jpg|jpeg|webp|gif|ico|icns|svg|woff2?|ttf|eot|pdf|zip|gz|mp4|webm|lock)$/i;

for (const f of files) {
  const base = f.split("/").pop() ?? f;
  if (/^\.env(\.|$)/.test(base) && base !== ".env.example") {
    problems.push(`committed env file that may hold secrets: ${f} (only .env.example may be committed)`);
    continue;
  }
  if (FORBIDDEN_FILE_PATTERNS.some((rx) => rx.test(base))) {
    problems.push(`forbidden credential or signing file in repo: ${f}`);
    continue;
  }
  if (BINARY_EXT.test(f) || f === "scripts/check-security.mjs" || !existsSync(f)) {
    continue;
  }
  let text;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const guard of CONTENT_GUARDS) {
    if (guard.rx.test(text)) {
      problems.push(`${f} contains ${guard.label}`);
    }
  }
}

if (problems.length) {
  console.error("check:security FAILED (AGENTS.md security):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(
  `check:security OK — security headers present, scanned ${files.length} files with zero secrets or personal path leaks.`,
);
