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
});
