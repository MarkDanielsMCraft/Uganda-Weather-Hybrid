import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.ts", () => {
  it("generates correct robots configuration", () => {
    const config = robots();
    expect(config.rules).toBeDefined();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].allow).toContain("/");
    expect(rules[0].allow).toContain("/api/og");
    expect(rules[0].disallow).toContain("/api/");
    expect(config.sitemap).toMatch(/sitemap\.xml$/);
  });
});
