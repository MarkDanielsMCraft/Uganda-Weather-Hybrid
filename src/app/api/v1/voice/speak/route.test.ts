import { beforeEach, describe, expect, it, vi } from "vitest";

const synthesizeSunbirdSpeech = vi.fn();
const synthesizeEnglishNeuralSpeech = vi.fn();
const flags = { sunbird: true, englishCloud: false, gemini: false };

vi.mock("@/lib/voice/sunbird", () => ({
  isSunbirdConfigured: () => flags.sunbird,
  isEnglishCloudVoiceEnabled: () => flags.englishCloud,
  synthesizeSunbirdSpeech: (...args: unknown[]) => synthesizeSunbirdSpeech(...args),
}));

vi.mock("@/lib/voice/gemini-tts", () => ({
  isGeminiTtsConfigured: () => flags.gemini,
  synthesizeEnglishNeuralSpeech: (...args: unknown[]) => synthesizeEnglishNeuralSpeech(...args),
}));

import { POST } from "@/app/api/v1/voice/speak/route";

let ipCounter = 0;

function speakRequest(text: string, language: "en" | "lg") {
  ipCounter += 1;
  return new Request("http://localhost/api/v1/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": `10.0.0.${ipCounter}` },
    body: JSON.stringify({ text, language }),
  });
}

const AUDIO = { audio: new ArrayBuffer(4), contentType: "audio/mpeg" };

describe("POST /api/v1/voice/speak", () => {
  beforeEach(() => {
    flags.sunbird = true;
    flags.englishCloud = false;
    flags.gemini = false;
    synthesizeSunbirdSpeech.mockReset().mockResolvedValue(AUDIO);
    synthesizeEnglishNeuralSpeech.mockReset().mockResolvedValue(AUDIO);
  });

  it("does not send English to the Luganda voice service unless the owner turns it on", async () => {
    const response = await POST(speakRequest("Rain likely in Gulu.", "en"));

    expect(response.status).toBe(503);
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
  });

  it("uses English through the Luganda voice service when the owner turns it on", async () => {
    flags.englishCloud = true;

    const response = await POST(speakRequest("Rain likely in Mbale.", "en"));

    expect(response.status).toBe(200);
    expect(synthesizeSunbirdSpeech).toHaveBeenCalledWith(
      "Rain likely in Mbale.",
      "en",
      expect.anything(),
    );
  });

  it("prefers the Gemini voice for English when it is set up", async () => {
    flags.gemini = true;
    flags.englishCloud = true;

    const response = await POST(speakRequest("Wind on Lake Victoria.", "en"));

    expect(response.status).toBe(200);
    expect(synthesizeEnglishNeuralSpeech).toHaveBeenCalled();
    expect(synthesizeSunbirdSpeech).not.toHaveBeenCalled();
  });

  it("always uses the Luganda voice service for Luganda", async () => {
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
});
