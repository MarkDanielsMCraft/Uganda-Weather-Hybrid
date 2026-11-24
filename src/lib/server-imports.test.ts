import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = resolve(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function isClientFile(file: string): boolean {
  return /^\s*["']use client["']/.test(readFileSync(file, "utf8"));
}

/** Where each name a file offers really comes from, following
    `export { a } from` and `export * from` lines through any depth. */
function clientSourceOfName(file: string, name: string, seen = new Set<string>()): string | null {
  if (seen.has(file)) return null;
  seen.add(file);
  if (isClientFile(file)) return file;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/^export\s+(?!type\b)\{([^}]*)\}\s+from\s+["']([^"']+)["']/gm)) {
    const names = match[1]!.split(",").map((part) => part.trim().split(/\s+as\s+/).pop()!.trim());
    if (!names.includes(name)) continue;
    const original = match[1]!.split(",").map((part) => part.trim()).find((part) => part.split(/\s+as\s+/).pop()!.trim() === name)!;
    const target = resolveImport(file, match[2]!);
    if (target) return clientSourceOfName(target, original.split(/\s+as\s+/)[0]!.trim(), seen);
  }
  for (const match of text.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
    const target = resolveImport(file, match[1]!);
    if (!target) continue;
    const exported = readFileSync(target, "utf8");
    if (new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b`).test(exported) || isClientFile(target)) {
      const found = clientSourceOfName(target, name, seen);
      if (found) return found;
    }
  }
  return null;
}

describe("server code never imports a browser only file", () => {
  it("keeps API routes and server libraries away from \"use client\" code, even through re-exports", () => {
    const serverFiles = [
      ...sourceFiles(join(ROOT, "src/app/api")),
      ...sourceFiles(join(ROOT, "src/lib/agriculture")),
      ...sourceFiles(join(ROOT, "src/lib/weather")),
      ...sourceFiles(join(ROOT, "src/lib/push")),
      ...sourceFiles(join(ROOT, "src/lib/alerts")),
      ...sourceFiles(join(ROOT, "src/lib/places")).filter((file) => /resolve-place|geocode|uganda-localities/.test(file)),
    ].filter((file) => !isClientFile(file));

    const problems: string[] = [];
    for (const file of serverFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/^import\s+(?!type\b)(?:\{([^}]*)\}|(\w+))[^;]*?from\s+["']([^"']+)["']/gm)) {
        const target = resolveImport(file, match[3]!);
        if (!target) continue;
        const names = match[1]
          ? match[1].split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim()).filter(Boolean)
          : ["default"];
        for (const name of names) {
          const client = isClientFile(target) ? target : clientSourceOfName(target, name);
          if (client) problems.push(`${file.replace(ROOT, "")} imports ${name} from ${client.replace(ROOT, "")}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
