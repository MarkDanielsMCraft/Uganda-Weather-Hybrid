import { beforeEach, describe, expect, it, vi } from "vitest";

const synthesizeSunbirdSpeech = vi.fn();
const synthesizeEnglishNeuralSpeech = vi.fn();
const synthesizeLugandaNeuralSpeech = vi.fn();
const streamGeminiNeuralSpeech = vi.fn();
const flags = { sunbird: true, gemini: false };

vi.mock("@/lib/voice/sunbird", () => ({
  isSunbirdConfigured: () => flags.sunbird,
  synthesizeSunbirdSpeech: (...args: unknown[]) => synthesizeSunbirdSpeech(...args),
}));

const quota = { allowed: true };
vi.mock("@/lib/quota/monthly-budget", () => ({
  reserveQuota: async () => quota.allowed,
}));

vi.mock("@/lib/voice/gemini-tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/voice/gemini-tts")>();
  return {
    ...actual,
    isGeminiTtsConfigured: () => flags.gemini,
    synthesizeEnglishNeuralSpeech: (...args: unknown[]) => synthesizeEnglishNeuralSpeech(...args),
    synthesizeLugandaNeuralSpeech: (...args: unknown[]) => synthesizeLugandaNeuralSpeech(...args),
    streamGeminiNeuralSpeech: (...args: unknown[]) => streamGeminiNeuralSpeech(...args),
  };
});

import { POST } from "@/app/api/v1/voice/speak/route";
import { clearVoiceCacheForTests } from "@/lib/voice/voice-cache";

let ipCounter = 0;

function speakRequest(
  text: string,
  language: "en" | "lg",
  extra: { stream?: boolean; sourceLanguage?: "en" | "lg" } = {},
) {
  ipCounter += 1;
  return new Request("http://localhost/api/v1/voice/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": `10.0.0.${ipCounter}`,
    },
    body: JSON.stringify({ text, language, ...extra }),
  });
}

const AUDIO = { audio: new ArrayBuffer(4), contentType: "audio/mpeg" };

describe("POST /api/v1/voice/speak", () => {
  beforeEach(() => {
    clearVoiceCacheForTests();
    delete process.env.VOICE_LUGANDA_PRIMARY;
    flags.sunbird = true;
    flags.gemini = false;
    quota.allowed = true;
    synthesizeSunbirdSpeech.mockReset().mockResolvedValue(AUDIO);
    synthesizeEnglishNeuralSpeech.mockReset().mockResolvedValue(AUDIO);
    synthesizeLugandaNeuralSpeech.mockReset().mockResolvedValue(AUDIO);
    streamGeminiNeuralSpeech.mockReset();
  });

  it("never sends English to the Luganda voice service", async () => {
    const response = await POST(speakRequest("Rain likely in Gulu.", "en"));

    expect(response.status).toBe(503);
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
  });

  it("prefers the Gemini voice for English when it is set up", async () => {
    flags.gemini = true;

    const response = await POST(speakRequest("Wind on Lake Victoria.", "en"));

    expect(response.status).toBe(200);
    expect(synthesizeEnglishNeuralSpeech).toHaveBeenCalled();
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
  });

  it("uses Sunbird for Luganda when only Sunbird is configured", async () => {
    const response = await POST(speakRequest("Enkuba esuubirwa leero.", "lg"));

    expect(response.status).toBe(200);
    expect(synthesizeSunbirdSpeech).toHaveBeenCalledWith(
      "Enkuba esuubirwa leero.",
      "lg",
      expect.anything(),
      undefined,
    );
  });

  it("refuses requests from other websites before spending any voice quota", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await POST(
      new Request("http://localhost/api/v1/voice/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "sec-fetch-site": "cross-site",
          origin: "https://other-site.example",
        },
        body: JSON.stringify({ text: "Rain likely in Gulu.", language: "lg" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stops paid voice calls once the monthly budget is used up", async () => {
    quota.allowed = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(speakRequest("Budget test sentence.", "lg"));

    expect(response.status).toBe(503);
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("shares one synthesis call when two visitors ask for the exact same uncached sentence at once", async () => {
    let resolveSynthesis = undefined as ((audio: typeof AUDIO) => void) | undefined;
    synthesizeSunbirdSpeech.mockImplementationOnce(
      () =>
        new Promise<typeof AUDIO>((resolve) => {
          resolveSynthesis = resolve;
        }),
    );

    const p1 = POST(speakRequest("Simultaneous Kampala Luganda request.", "lg"));
    const p2 = POST(speakRequest("Simultaneous Kampala Luganda request.", "lg"));

    await vi.waitFor(() => {
      expect(synthesizeSunbirdSpeech).toHaveBeenCalledTimes(1);
    });
    resolveSynthesis?.(AUDIO);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(synthesizeSunbirdSpeech).toHaveBeenCalledTimes(1);
  });

  it("uses fast Gemini 3.8 Flash TTS first for Luganda and falls back to Sunbird when Gemini fails", async () => {
    flags.sunbird = true;
    flags.gemini = true;

    // 1. Primary Gemini 3.8 Flash TTS succeeds -> Sunbird fallback is not called
    const okPrimary = await POST(speakRequest("Embeera y'obudde mu Kampala leero: Nteefu.", "lg"));
    expect(okPrimary.status).toBe(200);
    expect(okPrimary.headers.get("X-Voice-Provider")).toBe("gemini");
    expect(synthesizeLugandaNeuralSpeech).toHaveBeenCalledTimes(1);
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();

    // 2. Gemini fails (429 / 502) -> falls back immediately to Sunbird Luganda TTS
    synthesizeLugandaNeuralSpeech.mockRejectedValueOnce(new Error("GEMINI_TTS_HTTP_429"));
    const fallbackRes = await POST(speakRequest("Embeera y'obudde mu Gulu leero: Nteefu.", "lg"));
    expect(fallbackRes.status).toBe(200);
    expect(fallbackRes.headers.get("X-Voice-Provider")).toBe("sunbird");
    expect(synthesizeSunbirdSpeech).toHaveBeenCalledWith(
      "Embeera y'obudde mu Gulu leero: Nteefu.",
      "lg",
      expect.anything(),
      undefined,
    );
  });

  it("streams raw audio/L16 PCM chunks immediately and caches the compacted WAV clip for instant replay", async () => {
    flags.sunbird = true;
    flags.gemini = true;

    async function* fakePcmStream() {
      yield { pcmBytes: new Uint8Array([1, 2, 3, 4]), sampleRate: 24_000 };
      yield { pcmBytes: new Uint8Array([5, 6, 7, 8]), sampleRate: 24_000 };
    }
    streamGeminiNeuralSpeech.mockImplementationOnce(() => fakePcmStream());

    const streamRes = await POST(
      speakRequest("Clear skies across Kampala this morning.", "en", { stream: true }),
    );
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("Content-Type")).toContain("audio/L16;rate=24000");
    expect(streamRes.headers.get("X-Voice-Provider")).toBe("gemini");
    expect(streamRes.headers.get("X-Voice-Cache")).toBe("MISS");

    const streamedBytes = new Uint8Array(await streamRes.arrayBuffer());
    expect(Array.from(streamedBytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // Subsequent call for the exact same sentence hits the server WAV cache immediately
    await vi.waitFor(async () => {
      const cachedRes = await POST(
        speakRequest("Clear skies across Kampala this morning.", "en", { stream: true }),
      );
      expect(cachedRes.headers.get("X-Voice-Cache")).toBe("HIT");
      expect(cachedRes.headers.get("Content-Type")).toBe("audio/wav");
    });
  });

  it("falls back to Sunbird when a Luganda streaming call fails before the first audio chunk", async () => {
    flags.sunbird = true;
    flags.gemini = true;

    async function* failingLgStream(): AsyncGenerator<{ pcmBytes: Uint8Array; sampleRate: number }> {
      throw new Error("GEMINI_TTS_HTTP_429");
    }
    streamGeminiNeuralSpeech.mockImplementationOnce(() => failingLgStream());

    const res = await POST(
      speakRequest("Enkuba esuubirwa mu Entebbe akawungeezi kano.", "lg", { stream: true }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Voice-Provider")).toBe("sunbird");
    expect(synthesizeSunbirdSpeech).toHaveBeenCalledTimes(1);
  });
});
