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
    expect(kampala?.priority).toBe(0.95);
    expect(kampala?.changeFrequency).toBe("hourly");

    expect(urls.some((u) => u.endsWith("/lg"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lg/forecast"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/lg/lake-victoria"))).toBe(true);
    const kampalaLg = entries.find((e) => e.url.endsWith("/lg/district/kampala"));
    expect(kampalaLg?.priority).toBe(0.9);
    expect(kampalaLg?.changeFrequency).toBe("hourly");
  });
});
