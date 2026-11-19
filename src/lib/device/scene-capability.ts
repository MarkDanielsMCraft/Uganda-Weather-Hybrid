/**
 * Whether this device should get the static backdrop instead of the animated
 * weather scene.
 *
 * The scene is a full screen canvas repainting every frame. Measured on a
 * mid-range Android profile it held the main thread at 100 percent busy for
 * as long as the page was open, which is the whole of the app's Total
 * Blocking Time: with the canvas removed the same page recorded zero long
 * tasks. It is decorative, and it was costing the slowest devices the most
 * while giving them the least.
 *
 * So the default now follows the hardware rather than assuming everyone can
 * afford it. Lite mode is not a downgrade here, it is what the engine already
 * does for reduced motion: paint one frame of the same scene and stop
 * animating. The picture is the same, the perpetual repaint is not.
 */

interface NetworkInformation {
  saveData?: boolean;
}

export function prefersLightweightScene(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    // Before mount there is no way to know. Assume constrained: starting
    // static and upgrading costs a capable device one repaint, while
    // starting animated and downgrading spends exactly the main thread time
    // on the weakest devices that this is meant to protect.
    return true;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return true;

  // Reported in GiB, rounded down to a power of two, and absent on Safari.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory < 2) return true;

  // Constrained devices with 2 or fewer cores.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return true;

  return false;
}
