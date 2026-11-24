import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MapServiceBusyError,
  NOMINATIM_GAP_MS,
  NOMINATIM_MAX_WAITING,
  resetNominatimPacerForTests,
  waitForNominatimTurn,
} from "@/lib/places/nominatim-pacer";

describe("map service queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    resetNominatimPacerForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("lets the first lookup through at once and spaces the next ones out", async () => {
    const started: number[] = [];
    const turns = [0, 1, 2].map(() => waitForNominatimTurn().then(() => started.push(Date.now())));
    await vi.advanceTimersByTimeAsync(NOMINATIM_GAP_MS * 3);
    await Promise.all(turns);
    expect(started[1]! - started[0]!).toBeGreaterThanOrEqual(NOMINATIM_GAP_MS);
    expect(started[2]! - started[1]!).toBeGreaterThanOrEqual(NOMINATIM_GAP_MS);
  });

  it("refuses new lookups straight away when a flood fills the queue", async () => {
    const queued = Array.from({ length: NOMINATIM_MAX_WAITING + 1 }, () => waitForNominatimTurn());
    await expect(waitForNominatimTurn()).rejects.toBeInstanceOf(MapServiceBusyError);
    await vi.advanceTimersByTimeAsync(NOMINATIM_GAP_MS * (NOMINATIM_MAX_WAITING + 2));
    await Promise.all(queued);
  });
});
