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

    // Luganda never uses local robotic browser speechSynthesis voices, even if advertised
    getVoices.mockReturnValueOnce([{ lang: "lg-UG", name: "Luganda" }]);
    expect(isVoiceOutputSupported("lg")).toBe(false);

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
    for (const heard of ["two", "Two.", "2", "to", "1", "one", "stop", "is it safe to fish on Lake Victoria"]) {
      expect(isEchoOfSpokenReply(heard, reply)).toBe(false);
    }
  });
});

describe("supportsHandsFreeVoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers hands free voice only in English when live speech recognition is available; Luganda is tap to talk", async () => {
    const { supportsHandsFreeVoice } = await import("./advisor-voice");
    expect(supportsHandsFreeVoice("en")).toBe(false);
    vi.stubGlobal("webkitSpeechRecognition", class {});
    expect(supportsHandsFreeVoice("en")).toBe(true);
    expect(supportsHandsFreeVoice("lg")).toBe(false);
  });
});

describe("isHandsFreeCutInCommand and SpeechRecognition abort hygiene", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows only short choices or stop to cut in, never spoken follow up sentences", async () => {
    const { isHandsFreeCutInCommand } = await import("./advisor-voice");
    const choices = [
      "Will it rain tonight?",
      "What is the wind tomorrow?",
    ];
    for (const allowed of ["1", "one", "2", "two", "number two", "stop", "lekera awo"]) {
      expect(isHandsFreeCutInCommand(allowed, choices)).toBe(true);
    }
    for (const blocked of [
      "Will it rain tonight?",
      "Next, you can say one for: Will it rain tonight?",
      "for tomorrow",
      "twenty seven degrees in Kampala",
      "three",
    ]) {
      expect(isHandsFreeCutInCommand(blocked, choices)).toBe(false);
    }
  });

  it("suppresses trailing error and end callbacks after an explicit abort", () => {
    class AbortableRecognition {
      static last: AbortableRecognition | null = null;
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn(() => {
        this.onerror?.({ error: "aborted" });
        this.onend?.();
      });
      constructor() {
        AbortableRecognition.last = this;
      }
    }
    vi.stubGlobal("webkitSpeechRecognition", AbortableRecognition);
    const onError = vi.fn();
    const onEnd = vi.fn();
    const onStatusChange = vi.fn();

    const handle = startVoiceInput({
      language: "en",
      onTranscript: vi.fn(),
      onFinal: vi.fn(),
      onError,
      onEnd,
      onStatusChange,
    });
    expect(handle).not.toBeNull();
    handle?.abort();

    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });

  it("never rewrites a question with a different place or day into a suggested follow up", () => {
    const choices = [
      "Will it rain tonight?",
      "Safe to farm or dry crops today?",
      "Best hours to farm or dry crops tomorrow?",
    ];
    expect(resolveHandsFreeVoiceCommand("Will it rain tonight in Gulu?", choices)).toEqual({
      kind: "message",
      prompt: "Will it rain tonight in Gulu?",
    });
    expect(resolveHandsFreeVoiceCommand("Will it rain tomorrow?", choices)).toEqual({
      kind: "message",
      prompt: "Will it rain tomorrow?",
    });
    expect(resolveHandsFreeVoiceCommand("Safe to farm or dry crops tomorrow?", choices)).toEqual({
      kind: "message",
      prompt: "Safe to farm or dry crops tomorrow?",
    });
    expect(
      resolveHandsFreeVoiceCommand("Best hours to farm or dry crops in Gulu tomorrow?", choices),
    ).toEqual({
      kind: "message",
      prompt: "Best hours to farm or dry crops in Gulu tomorrow?",
    });
    expect(resolveHandsFreeVoiceCommand("Will it rain tonight?", choices)).toEqual({
      kind: "followup",
      index: 0,
      prompt: "Will it rain tonight?",
    });
  });

  it("stops the microphone stream at once if stop is called while getUserMedia is still opening", async () => {
    const stopTrack = vi.fn();
    let resolveMic: ((stream: MediaStream) => void) | undefined;
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveMic = resolve;
            }),
        ),
      },
    });

    const onEnd = vi.fn();
    const handle = startVoiceInput({
      language: "lg",
      capabilities: { lugandaTts: true, lugandaStt: true, englishNeuralTts: false },
      onTranscript: vi.fn(),
      onFinal: vi.fn(),
      onEnd,
    });
    expect(handle).not.toBeNull();

    // User taps stop before the hardware stream resolves
    handle?.stop();
    resolveMic?.({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    await Promise.resolve();

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalled();
  });
});

describe("weak Ugandan mobile network voice start-speed safeguards", () => {
  afterEach(() => {
    stopVoiceOutput();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads chunk 0 alone before starting chunk 1 so weak connections do not split bandwidth", async () => {
    const { clearVoiceAudioCacheForTests } = await import("./advisor-voice");
    clearVoiceAudioCacheForTests();

    const requestedTexts: string[] = [];
    let resolveFirstFetch = undefined as ((res: Response) => void) | undefined;
    let playFirstAudio = undefined as (() => void) | undefined;

    class MockAudio {
      src = "";
      preload = "";
      muted = false;
      playsInline = false;
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      setAttribute = vi.fn();
      pause = vi.fn();
      play = vi.fn(() => {
        if (this.src.startsWith("blob:")) {
          this.onplay?.();
          playFirstAudio = () => this.onended?.();
        }
        return Promise.resolve();
      });
    }

    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:https://hybrid.uganda-weather.com/clip"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, init?: RequestInit) => {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
        requestedTexts.push(parsed.text ?? "");
        if (requestedTexts.length === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirstFetch = resolve;
          });
        }
        return Promise.resolve(
          new Response(new TextEncoder().encode("chunk-2"), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          }),
        );
      }),
    );

    const longLuganda =
      "Embeera y'obudde mu Kampala leero: Ekiddedde. Ebbugumu liri ku ddiguli abiri mu nnya, waggulu abiri mu musanvu ate wansi kkumi na mwenda. Omukisa gw'enkuba mu ssaawa mukaaga eziddako guli ku makumi ana ku kikumi.";

    const onEnd = vi.fn();
    speakAdvisorReply({
      text: longLuganda,
      language: "lg",
      capabilities: { lugandaTts: true, lugandaStt: true, englishNeuralTts: false },
      onEnd,
    });

    // Whole text is sent in one single request so streaming starts fast with 1 quota call
    expect(requestedTexts.length).toBe(1);
    expect(requestedTexts[0]).toBe(longLuganda);

    resolveFirstFetch?.(
      new Response(new TextEncoder().encode("chunk-1"), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    await vi.waitFor(() => {
      expect(playFirstAudio).toBeDefined();
    });
    playFirstAudio?.();
    await vi.waitFor(() => {
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
  });

  it("streams Web Audio PCM chunks immediately on arrival and fires onEnd only after the last audio buffer finishes", async () => {
    const { clearVoiceAudioCacheForTests } = await import("./advisor-voice");
    const { resetPcmStreamPlayerForTests } = await import("@/lib/voice/pcm-stream-player");
    clearVoiceAudioCacheForTests();
    resetPcmStreamPlayerForTests();

    const scheduledNodes: Array<{ onended: (() => void) | null }> = [];
    class MockAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createBuffer(_c: number, length: number, sampleRate: number) {
        const ch = new Float32Array(length);
        return { length, sampleRate, duration: length / sampleRate, getChannelData: () => ch };
      }
      createBufferSource() {
        const node = {
          buffer: null as { length: number } | null,
          onended: null as (() => void) | null,
          connect: () => undefined,
          disconnect: () => undefined,
          start: () => {
            if ((node.buffer?.length ?? 0) > 1) {
              scheduledNodes.push(node);
            }
          },
          stop: () => undefined,
        };
        return node;
      }
    }
    vi.stubGlobal("AudioContext", MockAudioContext);

    let pushNextStreamChunk: ((chunk: Uint8Array | null) => void) | undefined;
    const pcmStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        pushNextStreamChunk = (chunk) => {
          if (chunk) ctrl.enqueue(chunk);
          else ctrl.close();
        };
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(pcmStream, {
          status: 200,
          headers: { "Content-Type": "audio/L16;rate=24000;channels=1" },
        }),
      ),
    );

    const states: string[] = [];
    const onEnd = vi.fn();
    speakAdvisorReply({
      text: "Enkuba esuubirwa mu Kampala akawungeezi kano.",
      language: "lg",
      capabilities: { lugandaTts: true, lugandaStt: true, englishNeuralTts: false },
      onStateChange: (s) => states.push(s),
      onEnd,
    });

    expect(states).toContain("loading");
    await vi.waitFor(() => {
      expect(pushNextStreamChunk).toBeDefined();
    });

    // Push first 6000 bytes (125ms @ 24kHz) -> playback starts BEFORE stream ends!
    pushNextStreamChunk?.(new Uint8Array(6000));
    await vi.waitFor(() => {
      expect(states).toContain("playing");
    });
    expect(onEnd).not.toHaveBeenCalled();

    // Finish network stream -> onEnd still waits for physical audio buffer completion
    pushNextStreamChunk?.(null);
    await Promise.resolve();
    expect(onEnd).not.toHaveBeenCalled();

    for (const node of scheduledNodes) {
      node.onended?.();
    }
    await vi.waitFor(() => {
      expect(onEnd).toHaveBeenCalledTimes(1);
    });
    expect(states[states.length - 1]).toBe("idle");
    resetPcmStreamPlayerForTests();
  });

  it("uses instant device English speech on 2G or data-saver networks while keeping Luganda on Sunbird", async () => {
    const { clearVoiceAudioCacheForTests, isSlowOrConstrainedNetwork } = await import(
      "./advisor-voice"
    );
    clearVoiceAudioCacheForTests();

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "2g", saveData: false, rtt: 950, downlink: 0.2 },
    });
    expect(isSlowOrConstrainedNetwork()).toBe(true);

    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      speak,
      cancel: vi.fn(),
      getVoices: () => [{ lang: "en-GB", name: "English" }],
      speaking: false,
      pending: false,
      paused: false,
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    const fetchSpy = vi.fn(
      async () =>
        new Response(new TextEncoder().encode("lg-bytes"), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const states: string[] = [];
    speakAdvisorReply({
      text: "Kampala. Currently 24 degrees and clear skies.",
      language: "en",
      capabilities: { lugandaTts: true, lugandaStt: true, englishNeuralTts: true },
      onStateChange: (s) => states.push(s),
    });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(states[0]).toBe("playing");

    // Luganda has no built-in phone voice, so it still uses Sunbird on 2G
    speakAdvisorReply({
      text: "Embeera y'obudde mu Kampala leero: Ekiddedde.",
      language: "lg",
      capabilities: { lugandaTts: true, lugandaStt: true, englishNeuralTts: true },
    });
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: undefined,
    });
  });

  it("falls back to instant English browser voice after 4.5s even after pointerdown prefetch, updating state to playing and firing onEnd for hands-free", async () => {
    vi.useFakeTimers();
    const { clearVoiceAudioCacheForTests, prefetchVoiceClip } = await import("./advisor-voice");
    clearVoiceAudioCacheForTests();
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: undefined,
    });

    const utterances: Array<{ onend: (() => void) | null }> = [];
    const speak = vi.fn((u: { onend: (() => void) | null }) => {
      utterances.push(u);
    });
    vi.stubGlobal("speechSynthesis", {
      speak,
      cancel: vi.fn(),
      getVoices: () => [{ lang: "en-GB", name: "English" }],
      speaking: false,
      pending: false,
      paused: false,
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    // Simulate a hung mobile connection that never resolves
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const text = "Gulu. Currently 26 degrees and partly cloudy. Next, say one for tomorrow.";
    const caps = { lugandaTts: true, lugandaStt: true, englishNeuralTts: true };

    // Simulate mobile pointerdown firing prefetch milliseconds before tap
    prefetchVoiceClip({ text, language: "en", capabilities: caps });

    const states: string[] = [];
    const onEnd = vi.fn();
    speakAdvisorReply({
      text,
      language: "en",
      capabilities: caps,
      onStateChange: (s) => states.push(s),
      onEnd,
    });

    expect(states).toContain("loading");
    expect(speak).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4_600);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(states).toContain("playing");

    // Completing the browser utterance must fire onEnd so hands-free listening resumes
    for (const u of utterances) {
      u.onend?.();
    }
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(states[states.length - 1]).toBe("idle");
  });

  it("distinguishes human barge-in interruptions from speaker echo and interim 'To'", async () => {
    const { isHumanBargeInUtterance, isPauseOnlyVoiceCommand } = await import("./advisor-voice");
    const spoken =
      "Kampala City is clear tonight at 24 degrees Celsius. Next, you can say one for: Will it rain tomorrow, or say two for: Wind speed tomorrow, or say stop to end.";
    const followUps = ["Will it rain tomorrow?", "Wind speed tomorrow?"];

    // Speaker echo and telemetry echo must never cut in
    expect(
      isHumanBargeInUtterance({
        transcript: "Kampala City is clear tonight at 24 degrees Celsius",
        spokenReply: spoken,
        followUps,
        isFinal: true,
      }),
    ).toBe(false);
    expect(
      isHumanBargeInUtterance({
        transcript: "twenty seven degrees celsius and some clouds later on",
        spokenReply: spoken,
        followUps,
        isFinal: true,
      }),
    ).toBe(false);
    expect(
      isHumanBargeInUtterance({
        transcript: "To",
        spokenReply: spoken,
        followUps,
        isFinal: false,
      }),
    ).toBe(false);

    // Real user barge-ins (interim question openers, final questions, choices, and pause words) cut in immediately
    expect(
      isHumanBargeInUtterance({
        transcript: "That of",
        spokenReply: spoken,
        followUps,
        isFinal: false,
      }),
    ).toBe(true);
    expect(
      isHumanBargeInUtterance({
        transcript: "That of Waukesha",
        spokenReply: spoken,
        followUps,
        isFinal: true,
      }),
    ).toBe(true);
    expect(
      isHumanBargeInUtterance({
        transcript: "two",
        spokenReply: spoken,
        followUps,
        isFinal: false,
      }),
    ).toBe(true);
    expect(isPauseOnlyVoiceCommand("Wait")).toBe(true);
    expect(isPauseOnlyVoiceCommand("That of Waukesha")).toBe(false);
  });

  it("blocks mid-syllable self-echo stems ('For this evening in Kampal') and extracts human barge-in from echo-glued transcripts", async () => {
    const { extractHumanBargeInFromTranscript, isEchoOfSpokenReply, isHumanBargeInUtterance } =
      await import("./advisor-voice");
    const eveningReply =
      "For this evening in Kampala City, the weather remains dry and calm. Temperatures will cool from 26°C at 6:00 pm to 23°C at 8:00 pm and 21°C by 10:00 pm. Next, you can say one for: Will it rain tomorrow in Kampala City, or say two for: What are the temperatures for tomorrow, or ask another question, or say stop to end.";
    const followUps = [
      "Will it rain tomorrow in Kampala City?",
      "What are the temperatures for tomorrow?",
    ];

    // Exact bug caught in production: partial interim stem "For this evening in Kampal"
    // followed by final "For this evening in Kampala City" must NEVER cut in or submit
    expect(isEchoOfSpokenReply("For this evening in Kampal", eveningReply)).toBe(true);
    expect(
      isHumanBargeInUtterance({
        transcript: "For this evening in Kampal",
        spokenReply: eveningReply,
        followUps,
        isFinal: false,
      }),
    ).toBe(false);
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "For this evening in Kampal",
        spokenReply: eveningReply,
        followUps,
        isFinal: false,
      }),
    ).toBeNull();
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "For this evening in Kampala City",
        spokenReply: eveningReply,
        followUps,
        isFinal: true,
      }),
    ).toBeNull();

    // Advisor reading its own "...or say stop to end" footer must never extract "stop"
    expect(
      extractHumanBargeInFromTranscript({
        transcript:
          "Next, you can say one for: Will it rain tomorrow in Kampala City, or say stop to end",
        spokenReply: eveningReply,
        followUps,
        isFinal: true,
      }),
    ).toBeNull();
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "or say stop",
        spokenReply: eveningReply,
        followUps,
        isFinal: false,
      }),
    ).toBeNull();

    // When SpeechRecognition glues speaker echo in front of a real human interruption,
    // extract ONLY the human's trailing question or stop/pause command
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "For this evening in Kampala City the weather remains dry stop",
        spokenReply: eveningReply,
        followUps,
        isFinal: true,
      }),
    ).toBe("stop");
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "For this evening in Kampala City wait",
        spokenReply: eveningReply,
        followUps,
        isFinal: false,
      }),
    ).toBe("wait");
    expect(
      extractHumanBargeInFromTranscript({
        transcript: "For this evening in Kampala City what about Wakiso tonight",
        spokenReply: eveningReply,
        followUps,
        isFinal: true,
      }),
    ).toBe("what about Wakiso tonight");
  });
});
