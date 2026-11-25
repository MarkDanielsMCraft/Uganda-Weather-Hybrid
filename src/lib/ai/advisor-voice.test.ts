// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSpokenAdvisorTurnText,
  formatTextForSpeech,
  isVoiceInputSupported,
  isVoiceOutputSupported,
  resolveHandsFreeVoiceCommand,
  selectPreferredVoice,
  speakAdvisorReply,
  splitTextForPipelinedSpeech,
  startVoiceInput,
  stopVoiceOutput,
  verifyHumanSpeakerFrame,
} from "./advisor-voice";

describe("advisor-voice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports voice input unsupported when SpeechRecognition is absent", () => {
    expect(isVoiceInputSupported()).toBe(false);
    expect(
      startVoiceInput({
        language: "en",
        onTranscript: vi.fn(),
        onFinal: vi.fn(),
      }),
    ).toBeNull();
  });

  it("streams interim and final spoken transcripts when SpeechRecognition is available", () => {
    const startMock = vi.fn();
    class MockRecognition {
      static lastInstance: MockRecognition | null = null;
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = startMock;
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        MockRecognition.lastInstance = this;
      }
    }

    vi.stubGlobal("webkitSpeechRecognition", MockRecognition);
    expect(isVoiceInputSupported("en")).toBe(true);
    expect(isVoiceInputSupported("lg")).toBe(false);
    expect(
      startVoiceInput({
        language: "lg",
        onTranscript: vi.fn(),
        onFinal: vi.fn(),
      }),
    ).toBeNull();

    const onTranscript = vi.fn();
    const onFinal = vi.fn();
    const onEnd = vi.fn();

    const handle = startVoiceInput({
      language: "en",
      onTranscript,
      onFinal,
      onEnd,
    });
    expect(handle).not.toBeNull();
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(MockRecognition.lastInstance?.lang).toBe("en-UG");

    MockRecognition.lastInstance?.onresult?.({
      results: [{ isFinal: true, 0: { transcript: "Will it rain in Kampala today?" } }],
    });
    MockRecognition.lastInstance?.onend?.();

    expect(onTranscript).toHaveBeenCalledWith("Will it rain in Kampala today?");
    expect(onFinal).toHaveBeenCalledWith("Will it rain in Kampala today?");
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("speaks and cancels replies safely via speechSynthesis and hides Luganda when no native voice exists", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const getVoices = vi.fn(() => [{ lang: "en-US", name: "English" }]);
    class MockUtterance {
      text: string;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    vi.stubGlobal("speechSynthesis", { speak, cancel, getVoices });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    expect(isVoiceOutputSupported("en")).toBe(true);
    expect(isVoiceOutputSupported("lg")).toBe(false);
    expect(speakAdvisorReply({ text: "Enkuba enetonnya.", language: "lg" })).toBe(false);

    const ok = speakAdvisorReply({ text: "Light rain expected at 5 pm.", language: "en" });
    expect(ok).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);

    getVoices.mockReturnValueOnce([{ lang: "lg-UG", name: "Luganda" }]);
    expect(isVoiceOutputSupported("lg")).toBe(true);

    stopVoiceOutput();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("formats weather units cleanly and selects natural neural voices over robotic defaults", () => {
    expect(formatTextForSpeech("27°C with 49% rain and 10 km/h wind.")).toBe(
      "27 degrees Celsius with 49 percent rain and 10 kilometers per hour wind.",
    );

    const robotic = { name: "Fred", lang: "en-US", localService: true } as SpeechSynthesisVoice;
    const natural = { name: "Asilia Online (Natural)", lang: "en-KE", localService: false } as SpeechSynthesisVoice;
    expect(selectPreferredVoice([robotic, natural], "en")?.name).toBe("Asilia Online (Natural)");
  });

  it("enables Luganda voice output when server Luganda TTS capability is active", () => {
    expect(
      isVoiceOutputSupported("lg", {
        lugandaTts: true,
        lugandaStt: true,
        englishNeuralTts: false,
      }),
    ).toBe(true);
  });

  it("notifies the previous caller's onStateChange('idle') and onEnd when a new voice playback starts or stops", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const getVoices = vi.fn(() => [{ lang: "en-US", name: "English" }]);
    class MockUtterance {
      text: string;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("speechSynthesis", { speak, cancel, getVoices });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const firstStateChange = vi.fn();
    const firstEnd = vi.fn();
    const secondStateChange = vi.fn();

    speakAdvisorReply({
      text: "First broadcast from top bar.",
      language: "en",
      onStateChange: firstStateChange,
      onEnd: firstEnd,
    });
    expect(firstStateChange).toHaveBeenCalledWith("playing");

    // Starting a second playback from the advisor must reset the first listener to idle
    speakAdvisorReply({
      text: "Second broadcast from advisor.",
      language: "en",
      onStateChange: secondStateChange,
    });
    expect(firstStateChange).toHaveBeenLastCalledWith("idle");
    expect(firstEnd).toHaveBeenCalledTimes(1);
    expect(secondStateChange).toHaveBeenCalledWith("playing");
  });

  it("resolves continuous hands-free voice commands (one, two, emu, bbiri, spoken recommendation text, and stop/terminate)", () => {
    const followUps = [
      "What is the rain outlook for tomorrow?",
      "Are there any travel alerts for tonight?",
    ];

    expect(resolveHandsFreeVoiceCommand("one", followUps)).toEqual({
      kind: "followup",
      index: 0,
      prompt: "What is the rain outlook for tomorrow?",
    });
    expect(resolveHandsFreeVoiceCommand("number two", followUps)).toEqual({
      kind: "followup",
      index: 1,
      prompt: "Are there any travel alerts for tonight?",
    });
    expect(resolveHandsFreeVoiceCommand("emu", followUps)).toEqual({
      kind: "followup",
      index: 0,
      prompt: "What is the rain outlook for tomorrow?",
    });
    expect(resolveHandsFreeVoiceCommand("namba bbiri", followUps)).toEqual({
      kind: "followup",
      index: 1,
      prompt: "Are there any travel alerts for tonight?",
    });
    expect(
      resolveHandsFreeVoiceCommand("what is the rain outlook for tomorrow", followUps),
    ).toEqual({
      kind: "followup",
      index: 0,
      prompt: "What is the rain outlook for tomorrow?",
    });
    expect(resolveHandsFreeVoiceCommand("stop", followUps)).toEqual({ kind: "stop" });
    expect(resolveHandsFreeVoiceCommand("lekera awo", followUps)).toEqual({ kind: "stop" });
    expect(resolveHandsFreeVoiceCommand("Is it safe to spray coffee at 9 am?", followUps)).toEqual({
      kind: "message",
      prompt: "Is it safe to spray coffee at 9 am?",
    });

    const spokenEn = buildSpokenAdvisorTurnText("Calm weather tonight.", followUps, "en", true);
    expect(spokenEn).toContain("say one for: What is the rain outlook for tomorrow?");
    expect(spokenEn).toContain("or say two for: Are there any travel alerts for tonight?");
    expect(spokenEn).toContain("say stop to end");

    const spokenLg = buildSpokenAdvisorTurnText("Obudde buteefu.", followUps, "lg", true);
    expect(spokenLg).toContain("emu okubuuza:");
    expect(spokenLg).toContain("bbiri okubuuza:");
  });

  it("verifies human vocal formants and active speaker proximity for barge-in interruption", () => {
    const sampleRate = 48_000;
    const fftSize = 512;
    const binCount = fftSize / 2;
    const nyquist = sampleRate / 2;
    const binHz = nyquist / binCount;

    // Synthesize a human-like 900 Hz vocal waveform (time-domain)
    const humanTime = new Uint8Array(fftSize);
    for (let i = 0; i < fftSize; i += 1) {
      const s = Math.sin((2 * Math.PI * 900 * i) / sampleRate) * 0.25;
      humanTime[i] = Math.round(128 + s * 127);
    }
    const humanFreq = new Uint8Array(binCount);
    const vocalBin = Math.round(900 / binHz);
    humanFreq[vocalBin] = 220;
    humanFreq[vocalBin + 1] = 180;

    const lockedProfile = {
      baselineRms: 0.16,
      centroidHz: 920,
      updatedAt: Date.now(),
    };

    const matched = verifyHumanSpeakerFrame({
      timeData: humanTime,
      freqData: humanFreq,
      sampleRate,
      profile: lockedProfile,
      enforceProfileLock: true,
    });
    expect(matched.isHumanSpeech).toBe(true);
    expect(matched.matchesActiveSpeaker).toBe(true);

    // Low-frequency rumble (< 100 Hz, e.g. wind / table thump) must be rejected
    const rumbleFreq = new Uint8Array(binCount);
    rumbleFreq[1] = 240;
    const rumble = verifyHumanSpeakerFrame({
      timeData: humanTime,
      freqData: rumbleFreq,
      sampleRate,
      profile: lockedProfile,
      enforceProfileLock: true,
    });
    expect(rumble.isHumanSpeech).toBe(false);
    expect(rumble.matchesActiveSpeaker).toBe(false);

    // Distant / different speaker with a shifted vocal centroid (2100 Hz vs 920 Hz) must not match active speaker
    const otherSpeakerFreq = new Uint8Array(binCount);
    const highBin = Math.round(2100 / binHz);
    otherSpeakerFreq[highBin] = 210;
    const otherSpeaker = verifyHumanSpeakerFrame({
      timeData: humanTime,
      freqData: otherSpeakerFreq,
      sampleRate,
      profile: lockedProfile,
      enforceProfileLock: true,
    });
    expect(otherSpeaker.isHumanSpeech).toBe(true);
    expect(otherSpeaker.matchesActiveSpeaker).toBe(false);
  });

  it("splits long Luganda briefings into short pipelined sentence chunks for fast time-to-first-audio", () => {
    const longLg =
      "Embeera y'obudde mu Kampala leero nteefu era ebbugumu liri ku ddiguli abiri mu ttaano. Enkuba eyinza okutonnya ku ssaawa kkumi ez'olweggulo n'empewo ya kilomiita kkumi buli ssaawa. Bw'oyanika ebirime byo ku makya, bikung'aanye nga obudde tebunnatuuka ssaawa mwenda ezomuttuntu.";
    const chunks = splitTextForPipelinedSpeech(longLg);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]!.length).toBeLessThanOrEqual(135);
    expect(chunks.join(" ")).toContain("Kampala");
    expect(chunks.join(" ")).toContain("Bw'oyanika");
  });

  it("skips redundant speechSynthesis.cancel when idle and chunks long mobile briefings sequentially", () => {
    const spokenUtterances: Array<{ text: string; lang: string; onend: (() => void) | null }> = [];
    const speak = vi.fn((u: { text: string; lang: string; onend: (() => void) | null }) => {
      spokenUtterances.push(u);
    });
    const cancel = vi.fn();
    const resume = vi.fn();
    const getVoices = vi.fn(() => []);
    class MockUtterance {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    vi.stubGlobal("speechSynthesis", {
      speak,
      cancel,
      resume,
      getVoices,
      speaking: false,
      pending: false,
      paused: true,
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const onEnd = vi.fn();
    const longEnglish =
      "Kampala is currently 25 degrees with clear skies and light winds. Afternoon rain is possible after 4 pm with temperatures peaking near 28 degrees. Carry a light umbrella if traveling in the evening and keep grain covered before dusk.";

    const ok = speakAdvisorReply({
      text: longEnglish,
      language: "en",
      onEnd,
    });
    expect(ok).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(spokenUtterances[0]?.lang).toBe("en-GB");

    // Triggering onend on chunk 1 must advance to chunk 2 without dropping
    spokenUtterances[0]?.onend?.();
    expect(speak).toHaveBeenCalledTimes(2);
    spokenUtterances[1]?.onend?.();
    if (spokenUtterances[2]) {
      spokenUtterances[2].onend?.();
    }
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("hands free listening when nothing is heard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an empty listen once, instead of ending without a sign", () => {
    class SilentRecognition {
      static last: SilentRecognition | null = null;
      lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn(); stop = vi.fn(); abort = vi.fn();
      constructor() { SilentRecognition.last = this; }
    }
    vi.stubGlobal("webkitSpeechRecognition", SilentRecognition);
    const onError = vi.fn();
    const onFinal = vi.fn();
    startVoiceInput({ language: "en", onTranscript: vi.fn(), onFinal, onError, onEnd: vi.fn() });
    SilentRecognition.last?.onend?.();
    expect(onFinal).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("empty_transcript");
  });

  it("still picks the second suggestion when 'two' is heard", () => {
    const choices = ["Will it rain this afternoon?", "What is the weather like tomorrow?"];
    for (const heard of ["two", "Two.", "too", "number two", "the second one"]) {
      expect(resolveHandsFreeVoiceCommand(heard, choices)).toMatchObject({ kind: "followup", index: 1 });
    }
  });
});

describe("isEchoOfSpokenReply", () => {
  const reply = "Rain is likely after 3 pm in Kampala. Next, you can say one for: Will it rain tonight, or say two for: What about tomorrow, or say stop to end.";
  it("treats the app's own words as echo", async () => {
    const { isEchoOfSpokenReply } = await import("./advisor-voice");
    expect(isEchoOfSpokenReply("rain is likely after 3 pm", reply)).toBe(true);
    expect(isEchoOfSpokenReply("you can say one for will it rain tonight", reply)).toBe(true);
  });
  it("never treats a choice, stop, or a new question as echo", async () => {
    const { isEchoOfSpokenReply } = await import("./advisor-voice");
    for (const heard of ["two", "Two.", "one", "stop", "is it safe to fish on Lake Victoria"]) {
      expect(isEchoOfSpokenReply(heard, reply)).toBe(false);
    }
  });
});
