import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function resolveImport(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;
  const base = resolve(ROOT, "src", specifier.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function isClientFile(file: string): boolean {
  return /^\s*["']use client["']/.test(readFileSync(file, "utf8"));
}

describe("server code never imports a browser only file", () => {
  it("keeps API routes and server libraries away from \"use client\" files", () => {
    const serverFiles = [
      ...sourceFiles(join(ROOT, "src/app/api")),
      ...sourceFiles(join(ROOT, "src/lib/agriculture")),
      ...sourceFiles(join(ROOT, "src/lib/weather")),
      ...sourceFiles(join(ROOT, "src/lib/push")),
      ...sourceFiles(join(ROOT, "src/lib/alerts")),
    ].filter((file) => !isClientFile(file));

    const problems: string[] = [];
    for (const file of serverFiles) {
      const imports = [...readFileSync(file, "utf8").matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)];
      for (const [, specifier] of imports) {
        const target = resolveImport(specifier!);
        if (target && isClientFile(target)) problems.push(`${file.replace(ROOT, "")} imports ${specifier}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
