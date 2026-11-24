import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { getAllDistricts } from "@/lib/districts";

describe("sitemap.ts", () => {
  it("generates sitemap with all static routes and all districts", () => {
    const entries = sitemap();
    const districts = getAllDistricts();
    expect(entries.length).toBeGreaterThanOrEqual(16 + districts.length);

    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/forecast"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/air-quality"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lake-victoria"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/district/kampala"))).toBe(true);

    const kampala = entries.find(
      (e) => e.url.endsWith("/district/kampala") && !e.url.includes("/lg/"),
    );
    expect(kampala).toBeDefined();

    expect(urls.some((u) => u.endsWith("/lg"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lg/forecast"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lg/lake-victoria"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lg/district/kampala"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lite"))).toBe(true);
  });

  it("lists each address once and claims no dates or priorities it cannot back up", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const entry of entries) {
      expect(entry.lastModified).toBeUndefined();
      expect(entry.priority).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
    }
  });
});
