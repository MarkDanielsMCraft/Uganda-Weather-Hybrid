import { afterEach, describe, expect, it, vi } from "vitest";
import { pcm16ToWav, synthesizeEnglishNeuralSpeech } from "@/lib/voice/gemini-tts";
import { normalizeLugandaForSpeech, numberToLugandaWords } from "@/lib/voice/luganda-speech";
import { synthesizeLugandaSpeech, transcribeLugandaAudio } from "@/lib/voice/sunbird";
import { GET as getVoiceStatus } from "@/app/api/v1/voice/status/route";
import { POST as postVoiceSpeak } from "@/app/api/v1/voice/speak/route";
import { POST as postVoiceTranscribe } from "@/app/api/v1/voice/transcribe/route";
import { POST as postVoiceTranslate } from "@/app/api/v1/voice/translate/route";

describe("voice providers and API routes", () => {
  const originalSunbird = process.env.SUNBIRD_API_TOKEN;
  const originalGemini = process.env.GEMINI_API_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSunbird === undefined) delete process.env.SUNBIRD_API_TOKEN;
    else process.env.SUNBIRD_API_TOKEN = originalSunbird;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  });

  it("builds a valid RIFF WAVE header around 16-bit PCM bytes", () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const wav = pcm16ToWav(pcm, 24000);
    const bytes = new Uint8Array(wav);
    expect(bytes.byteLength).toBe(48);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe("data");
    expect(Array.from(bytes.slice(44))).toEqual([1, 2, 3, 4]);
  });

  it("synthesizes Luganda speech via Sunbird AI speaker 248 and blocks untrusted audio hosts", async () => {
    process.env.SUNBIRD_API_TOKEN = "test-sunbird-token";
    const audioPayload = new Uint8Array([10, 20, 30]).buffer;

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: { audio_url: "https://storage.googleapis.com/sunbird/tts/sample.mp3" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(audioPayload, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );

    const result = await synthesizeLugandaSpeech("Leero enkuba enetonnya e Kampala.");
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audio.byteLength).toBe(3);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output: { audio_url: "https://evil.example.com/payload.mp3" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(synthesizeLugandaSpeech("Test")).rejects.toThrow("VOICE_TTS_INVALID_AUDIO_URL");
  });

  it("transcribes Luganda audio via Sunbird AI STT", async () => {
    process.env.SUNBIRD_API_TOKEN = "test-sunbird-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ output: { text: "Embeera y'obudde e Kampala eri etya?" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const transcript = await transcribeLugandaAudio(new Blob(["abc"], { type: "audio/webm" }), "voice.webm");
    expect(transcript).toBe("Embeera y'obudde e Kampala eri etya?");
  });

  it("synthesizes English neural speech via Gemini TTS and wraps PCM to WAV", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const base64Pcm = Buffer.from([5, 6, 7, 8]).toString("base64");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: base64Pcm, mimeType: "audio/L16;rate=24000" } }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await synthesizeEnglishNeuralSpeech("Kampala is 27 degrees Celsius.");
    expect(result.contentType).toBe("audio/wav");
    expect(result.audio.byteLength).toBe(48);
  });

  it("exposes accurate capability flags on GET /api/v1/voice/status", async () => {
    delete process.env.SUNBIRD_API_TOKEN;
    delete process.env.GEMINI_API_KEY;
    const resOff = await getVoiceStatus();
    const jsonOff = (await resOff.json()) as { data: { lugandaTts: boolean; lugandaStt: boolean; englishNeuralTts: boolean } };
    expect(jsonOff.data).toEqual({
      lugandaTts: false,
      lugandaStt: false,
      lugandaTranslation: false,
      englishNeuralTts: false,
    });

    process.env.SUNBIRD_API_TOKEN = "sb-token";
    delete process.env.GEMINI_API_KEY;
    delete process.env.VOICE_ENGLISH_CLOUD_ENABLED;
    const resSunbirdOnly = await getVoiceStatus();
    const jsonSunbirdOnly = (await resSunbirdOnly.json()) as {
      data: {
        lugandaTts: boolean;
        lugandaStt: boolean;
        lugandaTranslation: boolean;
        englishNeuralTts: boolean;
      };
    };
    expect(jsonSunbirdOnly.data).toEqual({
      lugandaTts: true,
      lugandaStt: true,
      lugandaTranslation: true,
      englishNeuralTts: false,
    });

    process.env.VOICE_ENGLISH_CLOUD_ENABLED = "true";
    const resCloudEn = await getVoiceStatus();
    const jsonCloudEn = (await resCloudEn.json()) as {
      data: {
        lugandaTts: boolean;
        lugandaStt: boolean;
        lugandaTranslation: boolean;
        englishNeuralTts: boolean;
      };
    };
    // The Luganda service reading English is too slow to count as the
    // natural English voice, so the browser voice is the backup instead.
    expect(jsonCloudEn.data).toEqual({
      lugandaTts: true,
      lugandaStt: true,
      lugandaTranslation: true,
      englishNeuralTts: false,
    });
    delete process.env.VOICE_ENGLISH_CLOUD_ENABLED;

    process.env.GEMINI_API_KEY = "gm-key";
    const resOn = await getVoiceStatus();
    const jsonOn = (await resOn.json()) as {
      data: {
        lugandaTts: boolean;
        lugandaStt: boolean;
        lugandaTranslation: boolean;
        englishNeuralTts: boolean;
      };
    };
    expect(jsonOn.data).toEqual({
      lugandaTts: true,
      lugandaStt: true,
      lugandaTranslation: true,
      englishNeuralTts: true,
    });
  });

  it("validates payloads and returns 503 when unconfigured on /api/v1/voice/speak and /transcribe", async () => {
    delete process.env.SUNBIRD_API_TOKEN;
    delete process.env.GEMINI_API_KEY;

    const badReq = new Request("http://localhost:3000/api/v1/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ text: "", language: "lg" }),
    });
    expect((await postVoiceSpeak(badReq)).status).toBe(400);

    const unconfiguredSpeak = new Request("http://localhost:3000/api/v1/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ text: "Enkuba enetonnya", language: "lg" }),
    });
    expect((await postVoiceSpeak(unconfiguredSpeak)).status).toBe(503);

    const unconfiguredTranscribe = new Request("http://localhost:3000/api/v1/voice/transcribe", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", "x-forwarded-for": "10.0.0.3" },
    });
    expect((await postVoiceTranscribe(unconfiguredTranscribe)).status).toBe(503);

    const unconfiguredTranslate = new Request("http://localhost:3000/api/v1/voice/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": "10.0.0.4" },
      body: JSON.stringify({ text: "Rain expected tonight", targetLanguage: "lg" }),
    });
    expect((await postVoiceTranslate(unconfiguredTranslate)).status).toBe(503);
  });

  it("converts numbers and weather units into spoken Luganda words", () => {
    expect(numberToLugandaWords(0)).toBe("zzeero");
    expect(numberToLugandaWords(18)).toBe("kkumi na munaana");
    expect(numberToLugandaWords(24)).toBe("abiri mu nnya");
    expect(numberToLugandaWords(96)).toBe("kyenda mu mukaaga");
    expect(
      normalizeLugandaForSpeech("Mbarara City. Ebbugumu 24°C, enkuba 96%, empewo 6 km/h."),
    ).toBe(
      "Ekibuga Mbarara. Ebbugumu ddiguli abiri mu nnya, enkuba ebitundu kyenda mu mukaaga ku kikumi, empewo kilomiita mukaaga buli ssaawa.",
    );
  });
});
