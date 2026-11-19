import { describe, expect, it } from "vitest";
import { PREFETCH_PRIORITY_SLUGS, prefetchSlugsForMode } from "./prefetch";

describe("prefetchSlugsForMode", () => {
  it("returns the fixed priority list for 'priority' mode, ignoring offset/limit", () => {
    const slugs = prefetchSlugsForMode("priority", 10, 5);
    expect(slugs).toEqual([...PREFETCH_PRIORITY_SLUGS]);
  });

  it("paginates all 152 districts for 'all' mode", () => {
    const page1 = prefetchSlugsForMode("all", 0, 50);
    const page2 = prefetchSlugsForMode("all", 50, 50);
    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(50);
    expect(page1[0]).not.toBe(page2[0]);
  });

  it("returns fewer than `limit` districts on the last, partial page", () => {
    // 152 districts total: offset 100 with limit 100 can only return 52.
    const lastPage = prefetchSlugsForMode("all", 100, 100);
    expect(lastPage.length).toBe(52);
    expect(lastPage.length).toBeLessThan(100);
  });

  it("returns an empty array once offset is past the end of the district list", () => {
    expect(prefetchSlugsForMode("all", 1000, 50)).toEqual([]);
  });
});
