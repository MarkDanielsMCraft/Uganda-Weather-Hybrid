import { describe, expect, it } from "vitest";
import { FrameBudget } from "./frame-budget";

/** Plays a sequence of frame intervals through the budget as the rising
    timestamps a real animation callback receives, and reports the frame
    index that first asked to stop, or null if it never did. */
function run(intervals: number[]) {
  const budget = new FrameBudget();
  let clock = 0;
  // The first call only establishes a baseline, so seed it.
  budget.record(clock);
  for (let i = 0; i < intervals.length; i += 1) {
    clock += intervals[i];
    if (budget.record(clock)) return i;
  }
  return null;
}

const many = (count: number, ms: number) => Array.from({ length: count }, () => ms);

/** A display refreshing at 60 Hz. */
const SMOOTH = 16.7;

describe("FrameBudget", () => {
  it("keeps animating when frames arrive at the display's refresh rate", () => {
    expect(run(many(600, SMOOTH))).toBeNull();
  });

  it("stops animating when the device cannot sustain a reasonable frame rate", () => {
    // ~8 fps.
    expect(run(many(600, 120))).not.toBeNull();
  });

  it("tolerates 30 fps rather than demanding a perfect 60", () => {
    expect(run(many(600, 30))).toBeNull();
  });

  it("ignores a slow warmup so shader compilation is not mistaken for the steady cost", () => {
    expect(run([...many(12, 500), ...many(400, SMOOTH)])).toBeNull();
  });

  it("does not give up over a single stall among smooth frames", () => {
    expect(run([...many(12, SMOOTH), 300, ...many(400, SMOOTH)])).toBeNull();
  });

  it("survives repeated isolated stalls", () => {
    // One stalled frame every twenty, forever. Averaging the window would
    // have killed the animation; this should ride it out.
    const frames: number[] = [...many(12, SMOOTH)];
    for (let i = 0; i < 40; i += 1) frames.push(400, ...many(19, SMOOTH));
    expect(run(frames)).toBeNull();
  });

  it("catches a device that only becomes slow later", () => {
    // Smooth for a long while, then consistently slow. Resetting the window
    // each time is what lets this be noticed at all.
    expect(run([...many(200, SMOOTH), ...many(200, 120)])).not.toBeNull();
  });

  it("waits for a real sample before judging, rather than tripping immediately", () => {
    const stoppedAt = run(many(600, 120));
    expect(stoppedAt).not.toBeNull();
    expect(stoppedAt as number).toBeGreaterThanOrEqual(12);
  });
});
