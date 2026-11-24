/** The free map service allows about one request a second from the whole app
    and blocks apps that go faster. Every lookup waits its turn here, and when
    too many are already waiting the caller is told to use a rough answer
    instead of piling up more requests. Each server copy has its own queue,
    so a few copies together still stay far below what floods would cause. */
export const NOMINATIM_GAP_MS = 1_100;
export const NOMINATIM_MAX_WAITING = 8;

let nextSlotAt = 0;
let waiting = 0;

export class MapServiceBusyError extends Error {
  constructor() {
    super("Map lookups are busy");
    this.name = "MapServiceBusyError";
  }
}

export async function waitForNominatimTurn(now: () => number = Date.now): Promise<void> {
  if (waiting >= NOMINATIM_MAX_WAITING) {
    console.warn("[places] action blocked action=map_lookup code=MAP_QUEUE_FULL");
    throw new MapServiceBusyError();
  }
  waiting += 1;
  try {
    const current = now();
    const slot = Math.max(current, nextSlotAt);
    nextSlotAt = slot + NOMINATIM_GAP_MS;
    if (slot > current) {
      await new Promise((resolve) => setTimeout(resolve, slot - current));
    }
  } finally {
    waiting -= 1;
  }
}

export function resetNominatimPacerForTests(): void {
  nextSlotAt = 0;
  waiting = 0;
}
