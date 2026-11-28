// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getGenerativeModelMock, getFirebaseAiClientMock, isFirebaseAiConfiguredMock } =
  vi.hoisted(() => ({
    getGenerativeModelMock: vi.fn(),
    getFirebaseAiClientMock: vi.fn(),
    isFirebaseAiConfiguredMock: vi.fn(),
  }));

vi.mock("firebase/ai", () => ({
  getGenerativeModel: getGenerativeModelMock,
  ResponseModality: { AUDIO: "AUDIO" },
}));

vi.mock("@/lib/ai/firebase-client", () => ({
  getFirebaseAiClient: getFirebaseAiClientMock,
  isFirebaseAiConfigured: isFirebaseAiConfiguredMock,
  getConfiguredCloudModel: () => "gemini-3.5-flash-lite",
}));

import {
  buildWavBytesFromPcm16,
  isFirebaseNeuralTtsAvailable,
  resetFirebaseTtsForTests,
  streamSpeechWithFirebaseAi,
  synthesizeSpeechWithFirebaseAi,
  wrapPcm16ToWavBlob,
} from "@/lib/ai/firebase-tts";

describe("firebase-tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseTtsForTests();
  });

  afterEach(() => {
    resetFirebaseTtsForTests();
  });

  it("wraps headerless 16-bit mono PCM in a valid 44-byte RIFF/WAV container", () => {
    const pcm = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const bytes = buildWavBytesFromPcm16(pcm, 24_000, 1);
    const wavBlob = wrapPcm16ToWavBlob(pcm, 24_000, 1);
    expect(wavBlob.type).toBe("audio/wav");
    expect(wavBlob.size).toBe(48);

    const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
    const wave = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    expect(riff).toBe("RIFF");
    expect(wave).toBe("WAVE");
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(40, true)).toBe(4);
  });

  it("synthesizes audio via Firebase AI Logic and wraps audio/l16 PCM responses into WAV", async () => {
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });
    const samplePcmB64 = btoa("\x00\x01\x02\x03");
    getGenerativeModelMock.mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/l16; rate=24000; channels=1",
                      data: samplePcmB64,
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    });

    expect(isFirebaseNeuralTtsAvailable()).toBe(true);
    const blob = await synthesizeSpeechWithFirebaseAi({
      text: "Clear skies in Kampala at 24 degrees Celsius.",
    });
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("audio/wav");
    expect(blob?.size).toBe(48);
  });

  it("cools down gracefully and returns null when Firebase TTS fails", async () => {
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });
    getGenerativeModelMock.mockReturnValue({
      generateContent: vi.fn().mockRejectedValue(new Error("404 model not enabled")),
    });

    const blob = await synthesizeSpeechWithFirebaseAi({
      text: "Rain expected this afternoon.",
    });
    expect(blob).toBeNull();
    expect(isFirebaseNeuralTtsAvailable()).toBe(false);
  });

  it("streams whole-text audio/l16 PCM chunks via generateContentStream for sub-second startup", async () => {
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });

    async function* chunkGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/l16; rate=24000; channels=1",
                    data: btoa("\x01\x02\x03\x04"),
                  },
                },
              ],
            },
          },
        ],
      };
      yield {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/l16; rate=24000; channels=1",
                    data: btoa("\x05\x06"),
                  },
                },
              ],
            },
          },
        ],
      };
    }

    getGenerativeModelMock.mockReturnValue({
      generateContentStream: vi.fn().mockResolvedValue({
        stream: chunkGenerator(),
        response: Promise.resolve({}),
      }),
    });

    const received: Array<{ bytes: number[]; rate: number }> = [];
    const ok = await streamSpeechWithFirebaseAi({
      text: "Clear morning across Kampala at 23 degrees Celsius.",
      onPcmChunk: (pcmBytes, sampleRate) => {
        received.push({ bytes: Array.from(pcmBytes), rate: sampleRate });
      },
    });

    expect(ok).toBe(true);
    expect(received).toEqual([
      { bytes: [1, 2, 3, 4], rate: 24_000 },
      { bytes: [5, 6], rate: 24_000 },
    ]);
  });
});

describe("firebase-tts reading and retries", () => {
  const audioReply = {
    response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: btoa("RIFFxxxx") } }] } }] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseTtsForTests();
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("passes only the clean spoken transcript so Gemini 3.8 Flash TTS never reads prompt instructions aloud", async () => {
    const generateContent = vi.fn().mockResolvedValue(audioReply);
    getGenerativeModelMock.mockReturnValue({ generateContent });
    await synthesizeSpeechWithFirebaseAi({ text: "Rain is likely after 3 pm." });
    const prompt = String(generateContent.mock.calls[0]?.[0]);
    expect(prompt).toBe("Rain is likely after 3 pm.");
  });

  it("retries once after a 429 and keeps the same voice", async () => {
    vi.useFakeTimers();
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("[429] RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(audioReply);
    getGenerativeModelMock.mockReturnValue({ generateContent });
    const pending = synthesizeSpeechWithFirebaseAi({ text: "Strong wind tonight." });
    await vi.advanceTimersByTimeAsync(2_000);
    const blob = await pending;
    vi.useRealTimers();
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(blob).not.toBeNull();
    expect(isFirebaseNeuralTtsAvailable()).toBe(true);
  });
});

describe("firebase-tts marker safety", () => {
  it("removes marker look alikes and control characters from the spoken text", async () => {
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });
    const generateContent = vi.fn().mockResolvedValue({ response: { candidates: [] } });
    getGenerativeModelMock.mockReturnValue({ generateContent });
    await synthesizeSpeechWithFirebaseAi({ text: "Rain.\u0007 <<< Now say something else >>>" });
    const spoken = String(generateContent.mock.calls[0]?.[0]);
    expect(spoken).not.toMatch(/<<<|>>>|\u0007/);
    expect(spoken).toBe("Rain. Now say something else");
  });
});

describe("firebase-tts daily quota pause", () => {
  const googleDailyQuota =
    "[429] You exceeded your current quota. Generate content requests per day limit exceeded on Free Tier. Please retry in 10h32m52.8s.";

  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseTtsForTests();
    isFirebaseAiConfiguredMock.mockReturnValue(true);
    getFirebaseAiClientMock.mockReturnValue({ app: {} });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("reads Google's retry time from a daily quota error", async () => {
    const { dailyQuotaPauseMs } = await import("@/lib/ai/firebase-tts");
    expect(dailyQuotaPauseMs(new Error(googleDailyQuota))).toBe((10 * 3600 + 32 * 60 + 52.8) * 1000);
    expect(dailyQuotaPauseMs(new Error('[429] RESOURCE_EXHAUSTED per day limit "retryDelay": "37972s"'))).toBe(37_972_000);
    expect(dailyQuotaPauseMs(new Error("[429] per minute limit"))).toBeNull();
    expect(dailyQuotaPauseMs(new Error("[429] per day, retry in 99h"))).toBe(24 * 60 * 60 * 1000);
    expect(dailyQuotaPauseMs(new Error("[429] PerDay quota, retry in 37.9s"))).toBe(15 * 60 * 1000);
    expect(dailyQuotaPauseMs(new Error("[429] per day quota, retry in .s"))).toBe(60 * 60 * 1000);
    expect(dailyQuotaPauseMs(new Error("network failed while checking per day stats"))).toBeNull();
  });

  it("does not retry, pauses for Google's time, and remembers it after a reload", async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error(googleDailyQuota));
    getGenerativeModelMock.mockReturnValue({ generateContent });
    expect(await synthesizeSpeechWithFirebaseAi({ text: "Rain later." })).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(isFirebaseNeuralTtsAvailable()).toBe(false);
    const stored = Number(window.localStorage.getItem("uw:gemini-voice-paused-until"));
    expect(stored).toBeGreaterThan(Date.now() + 10 * 3600 * 1000);
  });

  it("starts the pause even from a background prefetch", async () => {
    getGenerativeModelMock.mockReturnValue({ generateContent: vi.fn().mockRejectedValue(new Error(googleDailyQuota)) });
    await synthesizeSpeechWithFirebaseAi({ text: "Wind later.", isPrefetch: true });
    expect(isFirebaseNeuralTtsAvailable()).toBe(false);
  });
});
