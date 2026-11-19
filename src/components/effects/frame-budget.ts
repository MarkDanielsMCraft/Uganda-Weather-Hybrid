/**
 * Watches how fast the scene is actually managing to draw, and calls a halt
 * when the device cannot keep up.
 *
 * The capability check in `scene-capability.ts` reads what a device claims:
 * core count, memory, data saver. That misses two cases. A device can report
 * plenty of cores and still be busy or thermally throttled, and an auditing
 * tool can throttle the CPU heavily without touching `hardwareConcurrency`,
 * so it sees the animated scene a real phone of the profile it is imitating
 * would never afford.
 *
 * What this measures is the gap between frames, not the time spent inside
 * the draw call. Profiling this scene puts almost all of its cost in native
 * compositing and rasterisation, which happens after the animation callback
 * has already returned: timing that callback reports a few microseconds
 * while the machine is in fact fully occupied. The interval between frames
 * captures the whole cost wherever it lands, and answers the only question
 * worth asking, which is whether this device is keeping up right now.
 *
 * When it is not, the scene stops on its last painted frame, exactly where
 * lite mode leaves it. Nothing disappears; it just stops repainting.
 */

/** Slowest acceptable frame interval, in milliseconds. A display refreshing
    at 60 Hz delivers a frame every 16.7 ms, so this is about 31 fps: past
    here the animation is no longer smooth anyway, and it is starving the
    rest of the page to look bad. */
const SLOW_FRAME_MS = 55;
const WARMUP_FRAMES = 14;
const SAMPLE_FRAMES = 16;
const FAILING_SHARE = 0.75;

export class FrameBudget {
  private frames = 0;
  private sampled = 0;
  private slow = 0;
  private previousTimestamp: number | null = null;

  /**
   * Records one animation frame, given the timestamp the browser passed to
   * the frame callback. Returns true when the scene should stop animating.
   */
  record(timestamp: number): boolean {
    const previous = this.previousTimestamp;
    this.previousTimestamp = timestamp;
    if (previous === null) return false;

    const delta = timestamp - previous;

    this.frames += 1;
    if (this.frames <= WARMUP_FRAMES) return false;

    this.sampled += 1;
    if (delta > SLOW_FRAME_MS) this.slow += 1;
    if (this.sampled < SAMPLE_FRAMES) return false;

    const failing = this.slow / this.sampled;
    // Start a fresh window either way, so a device that only becomes slow
    // later — thermal throttling, another tab loading — is still caught, and
    // one bad window is not held against a device that recovers.
    this.sampled = 0;
    this.slow = 0;

    return failing >= FAILING_SHARE;
  }
}
