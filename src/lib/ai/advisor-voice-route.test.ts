// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const synthesizeSpeechWithFirebaseAi = vi.fn();
const isFirebaseNeuralTtsAvailable = vi.fn();

vi.mock("@/lib/ai/firebase-tts", () => ({
  isFirebaseNeuralTtsAvailable: () => isFirebaseNeuralTtsAvailable(),
  synthesizeSpeechWithFirebaseAi: (...args: unknown[]) => synthesizeSpeechWithFirebaseAi(...args),
}));

vi.mock("@/lib/ai/firebase-client", () => ({
  isFirebaseAiConfigured: () => true,
}));

vi.mock("@/lib/ai/firebase-audio-transcribe", () => ({
  transcribeEnglishAudioWithFirebaseAi: vi.fn(),
}));

import { speakAdvisorReply, stopVoiceOutput } from "@/lib/ai/advisor-voice";

const ENGLISH_SERVER_READY = {
  lugandaTts: true,
  lugandaStt: true,
  englishNeuralTts: true,
};

/** Each test speaks a different sentence because spoken clips are cached by
    text for the whole session, which is the behavior we want in the app. */
function waitForPlaybackToFinish(text: string): Promise<void> {
  return new Promise((resolve) => {
    const started = speakAdvisorReply({
      text,
      language: "en",
      capabilities: ENGLISH_SERVER_READY,
      onEnd: () => resolve(),
    });
    expect(started).toBe(true);
  });
}

describe("neural voice route", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    // A minimal reply with only what the voice code reads. Building a real
    // Response from a jsdom Blob fails on some Node versions used in CI.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["audio"], { type: "audio/mpeg" }),
    });
    synthesizeSpeechWithFirebaseAi.mockReset();
    isFirebaseNeuralTtsAvailable.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:voice");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      setTimeout(() => this.onended?.(new Event("ended")), 0);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    stopVoiceOutput();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the Firebase Gemini voice first for English", async () => {
    isFirebaseNeuralTtsAvailable.mockReturnValue(true);
    synthesizeSpeechWithFirebaseAi.mockResolvedValue(new Blob(["fb"], { type: "audio/wav" }));

    await waitForPlaybackToFinish("Rain likely this morning.");

    expect(synthesizeSpeechWithFirebaseAi).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the server voice, not the browser voice, when Firebase voice fails", async () => {
    isFirebaseNeuralTtsAvailable.mockReturnValue(true);
    synthesizeSpeechWithFirebaseAi.mockResolvedValue(null);

    await waitForPlaybackToFinish("Strong wind on the lake tonight.");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/voice/speak",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.language).toBe("en");
  });

  it("goes straight to the server voice while the Firebase voice is cooling down", async () => {
    isFirebaseNeuralTtsAvailable.mockReturnValue(false);

    await waitForPlaybackToFinish("Dry and sunny in Gulu.");

    expect(synthesizeSpeechWithFirebaseAi).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("Gemini voice request count", () => {
  it("sends a long answer to the Gemini voice in two requests at most", async () => {
    isFirebaseNeuralTtsAvailable.mockReturnValue(true);
    synthesizeSpeechWithFirebaseAi.mockResolvedValue(new Blob(["fb"], { type: "audio/wav" }));
    const longAnswer = Array.from({ length: 9 }, (_, i) => `Sentence number ${i + 1} about rain and wind over the farms today.`).join(" ");
    await new Promise<void>((resolve) => {
      speakAdvisorReply({ text: longAnswer, language: "en", capabilities: ENGLISH_SERVER_READY, onEnd: () => resolve() });
    });
    expect(synthesizeSpeechWithFirebaseAi.mock.calls.length).toBeLessThanOrEqual(2);
    const spoken = synthesizeSpeechWithFirebaseAi.mock.calls.map((call) => (call[0] as { text: string }).text).join(" ");
    expect(spoken).toContain("Sentence number 9");
  });
});
