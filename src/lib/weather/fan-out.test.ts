import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./fan-out";

describe("mapWithConcurrency", () => {
  it("returns results in the order of the input, not the order they finished", async () => {
    const items = [30, 5, 20, 1, 15];
    const out = await mapWithConcurrency(items, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(out).toEqual(items);
  });

  it("never runs more than the allowed number at once", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return null;
      },
      4,
    );
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("visits every item", async () => {
    const seen: number[] = [];
    await mapWithConcurrency(
      Array.from({ length: 19 }, (_, i) => i),
      async (n) => {
        seen.push(n);
        return n;
      },
      4,
    );
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, i) => i));
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], async () => 1)).toEqual([]);
  });

  it("does not stall when there are fewer items than the concurrency window", async () => {
    expect(await mapWithConcurrency([1, 2], async (n) => n * 2, 8)).toEqual([2, 4]);
  });
});
