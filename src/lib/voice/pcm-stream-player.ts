/**
 * Gapless Web Audio PCM16 streaming player for sub-second Gemini neural voice.
 *
 * Converts incoming 16-bit signed little-endian mono PCM chunks (`audio/l16`)
 * into back-to-back scheduled `AudioBufferSourceNode` buffers as bytes arrive
 * over the network, while assembling a complete RIFF/WAV `Blob` for instant
 * zero-network replay on subsequent clicks.
 */

const DEFAULT_SAMPLE_RATE = 24_000;
const INITIAL_JITTER_MS = 110;
const MAX_STREAM_PCM_BYTES = 8 * 1024 * 1024;

type AudioContextConstructor = typeof AudioContext;

function getAudioContextCtor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ||
    null
  );
}

export function isWebAudioStreamSupported(): boolean {
  return getAudioContextCtor() !== null;
}

let sharedStreamAudioContext: AudioContext | null = null;
let activeStreamCleanup: (() => void) | null = null;

function getOrCreateStreamAudioContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (
    !sharedStreamAudioContext ||
    sharedStreamAudioContext.state === "closed" ||
    !(sharedStreamAudioContext instanceof Ctor)
  ) {
    try {
      sharedStreamAudioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedStreamAudioContext;
}

export function resetPcmStreamPlayerForTests(): void {
  stopActivePcmStream();
  sharedStreamAudioContext = null;
}

/**
 * Unlocks and resumes the shared `AudioContext` synchronously inside a user
 * tap/click gesture so iOS Safari and Android Chrome allow async streamed
 * audio buffers to play unmuted once the first network chunk arrives.
 */
export function primePcmStreamAudioForGesture(): void {
  const ctx = getOrCreateStreamAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    const silent = ctx.createBuffer(1, 1, 22_050);
    const node = ctx.createBufferSource();
    node.buffer = silent;
    node.connect(ctx.destination);
    node.start(0);
  } catch {
    // Ignore unlock errors on headless or restricted environments
  }
}

export function stopActivePcmStream(): void {
  if (activeStreamCleanup) {
    const fn = activeStreamCleanup;
    activeStreamCleanup = null;
    fn();
  }
}

export function buildWavBlobFromPcmChunks(
  chunks: readonly Uint8Array[],
  sampleRate = DEFAULT_SAMPLE_RATE,
): Blob | null {
  let totalBytes = 0;
  for (const chunk of chunks) {
    totalBytes += chunk.byteLength;
  }
  const alignedBytes = totalBytes - (totalBytes % 2);
  if (alignedBytes <= 0) return null;

  const buffer = new ArrayBuffer(44 + alignedBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + alignedBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, alignedBytes, true);

  const out = new Uint8Array(buffer, 44, alignedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = alignedBytes - offset;
    if (remaining <= 0) break;
    if (chunk.byteLength <= remaining) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    } else {
      out.set(chunk.subarray(0, remaining), offset);
      offset += remaining;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export interface PcmStreamSession {
  pushPcm16(bytes: Uint8Array, sampleRate?: number): void;
  finish(): Promise<Blob | null>;
  abort(): void;
  hasStartedPlayback(): boolean;
}

export function createPcmStreamSession({
  onFirstPlay,
}: {
  onFirstPlay?: () => void;
} = {}): PcmStreamSession | null {
  const ctx = getOrCreateStreamAudioContext();
  if (!ctx) return null;

  stopActivePcmStream();
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  let aborted = false;
  let startedPlayback = false;
  let streamFinished = false;
  let streamSampleRate = DEFAULT_SAMPLE_RATE;
  let carryByte: number | null = null;
  let pendingChunks: Uint8Array[] = [];
  let pendingBytes = 0;
  const wavChunks: Uint8Array[] = [];
  let wavBytes = 0;
  let scheduledEndTime = 0;
  const activeNodes = new Set<AudioBufferSourceNode>();
  let fallbackEndTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveDone: ((blob: Blob | null) => void) | null = null;

  const clearFallbackTimer = () => {
    if (fallbackEndTimer !== null) {
      clearTimeout(fallbackEndTimer);
      fallbackEndTimer = null;
    }
  };

  const cleanupNodes = () => {
    clearFallbackTimer();
    for (const node of activeNodes) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already-stopped node errors
      }
    }
    activeNodes.clear();
  };

  const completeIfDrained = () => {
    if (aborted || !streamFinished || activeNodes.size > 0) return;
    clearFallbackTimer();
    if (activeStreamCleanup === abortSession) {
      activeStreamCleanup = null;
    }
    const done = resolveDone;
    resolveDone = null;
    const blob = wavBytes <= MAX_STREAM_PCM_BYTES ? buildWavBlobFromPcmChunks(wavChunks, streamSampleRate) : null;
    done?.(blob);
  };

  const abortSession = () => {
    if (aborted) return;
    aborted = true;
    cleanupNodes();
    pendingChunks = [];
    pendingBytes = 0;
    if (activeStreamCleanup === abortSession) {
      activeStreamCleanup = null;
    }
    const done = resolveDone;
    resolveDone = null;
    done?.(null);
  };

  activeStreamCleanup = abortSession;

  const flushPendingToAudio = () => {
    if (aborted || pendingBytes < 2) return;
    const usable = pendingBytes - (pendingBytes % 2);
    if (usable <= 0) return;

    const merged = new Uint8Array(usable);
    let writeOffset = 0;
    while (pendingChunks.length > 0 && writeOffset < usable) {
      const head = pendingChunks[0]!;
      const needed = usable - writeOffset;
      if (head.byteLength <= needed) {
        merged.set(head, writeOffset);
        writeOffset += head.byteLength;
        pendingChunks.shift();
      } else {
        merged.set(head.subarray(0, needed), writeOffset);
        writeOffset += needed;
        pendingChunks[0] = head.subarray(needed);
      }
    }
    pendingBytes -= usable;

    const sampleCount = usable / 2;
    const pcmView = new DataView(merged.buffer, merged.byteOffset, usable);
    const floats = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
      floats[i] = pcmView.getInt16(i * 2, true) / 32_768;
    }

    const audioBuffer = ctx.createBuffer(1, sampleCount, streamSampleRate);
    audioBuffer.getChannelData(0).set(floats);

    const node = ctx.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(ctx.destination);
    activeNodes.add(node);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.015, scheduledEndTime);
    scheduledEndTime = startAt + audioBuffer.duration;

    node.onended = () => {
      activeNodes.delete(node);
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      completeIfDrained();
    };

    if (!startedPlayback) {
      startedPlayback = true;
      onFirstPlay?.();
    }
    node.start(startAt);
  };

  return {
    pushPcm16(bytes: Uint8Array, sampleRate?: number) {
      if (aborted || bytes.byteLength === 0) return;
      if (!startedPlayback && sampleRate && Number.isFinite(sampleRate) && sampleRate >= 8_000) {
        streamSampleRate = sampleRate;
      }

      let alignedInput = bytes;
      if (carryByte !== null) {
        const joined = new Uint8Array(bytes.byteLength + 1);
        joined[0] = carryByte;
        joined.set(bytes, 1);
        carryByte = null;
        alignedInput = joined;
      }
      if (alignedInput.byteLength % 2 === 1) {
        carryByte = alignedInput[alignedInput.byteLength - 1]!;
        alignedInput = alignedInput.subarray(0, alignedInput.byteLength - 1);
      }
      if (alignedInput.byteLength === 0) return;

      const copy = new Uint8Array(alignedInput.byteLength);
      copy.set(alignedInput);
      if (wavBytes + copy.byteLength <= MAX_STREAM_PCM_BYTES) {
        wavChunks.push(copy);
      }
      wavBytes += copy.byteLength;

      pendingChunks.push(copy);
      pendingBytes += copy.byteLength;

      const minInitialBytes = Math.floor((streamSampleRate * 2 * INITIAL_JITTER_MS) / 1000);
      if (startedPlayback || pendingBytes >= minInitialBytes) {
        flushPendingToAudio();
      }
    },

    finish(): Promise<Blob | null> {
      if (aborted) return Promise.resolve(null);
      streamFinished = true;
      flushPendingToAudio();
      if (activeNodes.size === 0) {
        if (activeStreamCleanup === abortSession) {
          activeStreamCleanup = null;
        }
        const blob =
          startedPlayback && wavBytes <= MAX_STREAM_PCM_BYTES
            ? buildWavBlobFromPcmChunks(wavChunks, streamSampleRate)
            : null;
        return Promise.resolve(blob);
      }

      return new Promise<Blob | null>((resolve) => {
        resolveDone = resolve;
        const remainingSec = Math.max(0, scheduledEndTime - ctx.currentTime);
        // Safety fallback if a backgrounded browser tab throttles Web Audio onended
        fallbackEndTimer = setTimeout(() => {
          cleanupNodes();
          completeIfDrained();
        }, Math.ceil(remainingSec * 1000) + 350);
      });
    },

    abort: abortSession,

    hasStartedPlayback: () => startedPlayback,
  };
}
