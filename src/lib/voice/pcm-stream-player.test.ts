// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWavBlobFromPcmChunks,
  createPcmStreamSession,
  resetPcmStreamPlayerForTests,
  stopActivePcmStream,
} from "@/lib/voice/pcm-stream-player";

describe("pcm-stream-player", () => {
  afterEach(() => {
    resetPcmStreamPlayerForTests();
    vi.unstubAllGlobals();
  });

  it("handles odd-byte network splits cleanly, starts gapless playback on initial cushion, and returns a valid WAV blob after the last buffer ends", async () => {
    const startedNodes: Array<{
      startAt: number;
      duration: number;
      stopped: boolean;
      onended: (() => void) | null;
      samples: Float32Array<ArrayBufferLike>;
    }> = [];

    class FakeAudioContext {
      state = "running";
      currentTime = 1.0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createBuffer(_channels: number, length: number, sampleRate: number) {
        const channel = new Float32Array(length);
        return {
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: () => channel,
        };
      }
      createBufferSource() {
        const record: {
          startAt: number;
          duration: number;
          stopped: boolean;
          onended: (() => void) | null;
          samples: Float32Array<ArrayBufferLike>;
        } = {
          startAt: -1,
          duration: 0,
          stopped: false,
          onended: null,
          samples: new Float32Array(0),
        };
        const node = {
          buffer: null as { duration: number; getChannelData: () => Float32Array<ArrayBufferLike> } | null,
          onended: null as (() => void) | null,
          connect: () => undefined,
          disconnect: () => undefined,
          start: (when = 0) => {
            record.startAt = when;
            record.duration = node.buffer?.duration ?? 0;
            record.samples = node.buffer?.getChannelData() ?? new Float32Array(0);
            Object.defineProperty(record, "onended", {
              get: () => node.onended,
            });
            startedNodes.push(record);
          },
          stop: () => {
            record.stopped = true;
          },
        };
        return node;
      }
    }

    vi.stubGlobal("AudioContext", FakeAudioContext);

    let firstPlayCalls = 0;
    const session = createPcmStreamSession({
      onFirstPlay: () => {
        firstPlayCalls += 1;
      },
    });
    expect(session).not.toBeNull();

    // Create 6000 bytes (3000 samples at 24 kHz = 125ms > 110ms cushion) split across an odd boundary (2999 + 3001)
    const fullPcm = new Uint8Array(6000);
    const dv = new DataView(fullPcm.buffer);
    for (let i = 0; i < 3000; i += 1) {
      dv.setInt16(i * 2, i % 2 === 0 ? 16_384 : -16_384, true);
    }

    session!.pushPcm16(fullPcm.subarray(0, 2999), 24_000);
    // Below initial 110ms cushion (2998 aligned bytes < 5280 bytes), so not started yet
    expect(firstPlayCalls).toBe(0);

    session!.pushPcm16(fullPcm.subarray(2999), 24_000);
    expect(firstPlayCalls).toBe(1);
    expect(startedNodes).toHaveLength(1);
    expect(startedNodes[0]!.samples[0]).toBeCloseTo(0.5, 4);
    expect(startedNodes[0]!.samples[1]).toBeCloseTo(-0.5, 4);

    // Push a second chunk and verify back-to-back scheduling
    session!.pushPcm16(fullPcm.subarray(0, 2400), 24_000);
    expect(startedNodes).toHaveLength(2);
    expect(startedNodes[1]!.startAt).toBeCloseTo(
      startedNodes[0]!.startAt + startedNodes[0]!.duration,
      5,
    );

    let resolved = false;
    const finishPromise = session!.finish().then((blob) => {
      resolved = true;
      return blob;
    });

    // Must NOT resolve until the final AudioBufferSourceNode finishes playing!
    await Promise.resolve();
    expect(resolved).toBe(false);

    startedNodes[0]!.onended?.();
    await Promise.resolve();
    expect(resolved).toBe(false);

    startedNodes[1]!.onended?.();
    const wavBlob = await finishPromise;
    expect(resolved).toBe(true);
    expect(wavBlob).not.toBeNull();
    expect(wavBlob!.size).toBe(44 + 8400);
  });

  it("stops all scheduled nodes immediately when stopActivePcmStream is called", async () => {
    let stoppedCount = 0;
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createBuffer(_c: number, length: number, sampleRate: number) {
        const ch = new Float32Array(length);
        return { length, sampleRate, duration: length / sampleRate, getChannelData: () => ch };
      }
      createBufferSource() {
        return {
          buffer: null,
          onended: null,
          connect: () => undefined,
          disconnect: () => undefined,
          start: () => undefined,
          stop: () => {
            stoppedCount += 1;
          },
        };
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const session = createPcmStreamSession();
    session!.pushPcm16(new Uint8Array(6000), 24_000);
    const done = session!.finish();
    stopActivePcmStream();

    expect(stoppedCount).toBe(1);
    expect(await done).toBeNull();
  });

  it("wraps PCM chunks into a valid 16-bit mono RIFF/WAV header", async () => {
    const blob = buildWavBlobFromPcmChunks([new Uint8Array([1, 2, 3]), new Uint8Array([4])], 24_000);
    expect(blob).not.toBeNull();
    const ab = await blob!.arrayBuffer();
    const view = new DataView(ab);
    expect(ab.byteLength).toBe(48);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(40, true)).toBe(4);
  });
});
