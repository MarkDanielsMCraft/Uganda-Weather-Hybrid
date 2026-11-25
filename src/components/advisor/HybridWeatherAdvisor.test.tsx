// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HybridWeatherAdvisor } from "@/components/advisor/HybridWeatherAdvisor";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const mockDetectOnDeviceAvailability = vi.fn();
const mockGenerateHybridWeatherBriefing = vi.fn();
const mockIsFirebaseAiConfigured = vi.fn();

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    detectOnDeviceAvailability: () => mockDetectOnDeviceAvailability(),
    generateHybridWeatherBriefing: (...args: unknown[]) =>
      mockGenerateHybridWeatherBriefing(...args),
    isFirebaseAiConfigured: () => mockIsFirebaseAiConfigured(),
  };
});

describe("HybridWeatherAdvisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mockIsFirebaseAiConfigured.mockReturnValue(true);
    mockDetectOnDeviceAvailability.mockResolvedValue("unavailable");
  });

  afterEach(() => {
    cleanup();
  });

  it("opens from the floating launcher, shows greeting and quick prompts, and streams cloud reply", async () => {
    mockGenerateHybridWeatherBriefing.mockImplementation(
      async (opts: {
        onPhaseChange?: (phase: "thinking" | "writing") => void;
        onChunk?: (text: string) => void;
      }) => {
        opts.onPhaseChange?.("thinking");
        opts.onPhaseChange?.("writing");
        opts.onChunk?.("Dry morning in Kampala.");
        return {
          ok: true,
          data: {
            text: "Dry morning in Kampala.\nGood conditions for drying maize.",
            source: "cloud",
            model: "gemini-3.8-flash",
            generatedAt: "2026-11-19T09:00:00Z",
            usedCachedWeather: false,
          },
        };
      },
    );

    render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);

    fireEvent.click(screen.getByTestId("advisor-launcher"));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Cloud");
    });

    expect(screen.getByText("How can I help with today's weather?")).toBeInTheDocument();

    // Global design rules: global pill buttons, no gold, no pulsing indicators, no uppercase
    expect(document.body.querySelector(".rounded-full")).not.toBeNull();
    expect(document.body.innerHTML).not.toContain("--color-caution");
    expect(document.body.querySelector(".animate-pulse")).toBeNull();
    expect(document.body.querySelector(".uppercase")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-source-badge")).toHaveTextContent("Cloud");
    });
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Dry morning in Kampala.")).toBeInTheDocument();
  });

  it("renders the floating launcher even while weather is still loading", () => {
    render(<HybridWeatherAdvisor weather={null} districtName="Kampala" />);
    expect(screen.getByTestId("advisor-launcher")).toBeInTheDocument();
  });

  it("visibly switches status when toggling offline and back online", async () => {
    render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Cloud");
    });

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Offline");
    });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Cloud");
    });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("runs on-device briefing from cached forecast while offline when local model is available", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mockDetectOnDeviceAvailability.mockResolvedValue("available");
    mockGenerateHybridWeatherBriefing.mockResolvedValue({
      ok: true,
      data: {
        text: "Light southwest winds on the lake. Safe morning launch window.",
        source: "on_device",
        model: "on-device",
        generatedAt: "2026-11-19T09:05:00Z",
        usedCachedWeather: true,
      },
    });

    render(
      <HybridWeatherAdvisor
        weather={makeWeatherBundle({
          stale: true,
          district: {
            ...makeWeatherBundle().district,
            isLakeVictoriaZone: true,
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Offline local");
    });

    fireEvent.click(screen.getByRole("button", { name: /Lake wind and launch risk/i }));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-source-badge")).toHaveTextContent("On device");
    });
    expect(screen.getByText("Cached")).toBeInTheDocument();
    expect(mockGenerateHybridWeatherBriefing).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "fisher",
        isOnline: false,
      }),
    );
  });

  it("closes the glass panel when clicking outside in empty space", async () => {
    render(
      <div>
        <div data-testid="outside-space">Background</div>
        <HybridWeatherAdvisor weather={makeWeatherBundle()} />
      </div>,
    );

    fireEvent.click(screen.getByTestId("advisor-launcher"));
    expect(screen.getByText("How can I help with today's weather?")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside-space"));

    await waitFor(() => {
      expect(screen.queryByText("How can I help with today's weather?")).toBeNull();
    });
  });

  it("stops generation immediately when Stop is clicked and ignores late chunks", async () => {
    let emitChunk: ((text: string) => void) | undefined;
    let resolveCall: ((value: unknown) => void) | undefined;

    mockGenerateHybridWeatherBriefing.mockImplementation(
      (opts: { onChunk?: (text: string) => void }) => {
        emitChunk = opts.onChunk;
        return new Promise((resolve) => {
          resolveCall = resolve;
        });
      },
    );

    render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });

    // Late chunks and final resolution after Stop must be ignored
    act(() => {
      emitChunk?.("Late chunk that should not appear");
      resolveCall?.({
        ok: true,
        data: {
          text: "Late final text that should not appear",
          source: "cloud",
          model: "gemini-3.8-flash",
          generatedAt: "2026-11-19T09:10:00Z",
          usedCachedWeather: false,
        },
      });
    });

    expect(screen.queryByText("Late chunk that should not appear")).toBeNull();
    expect(screen.queryByText("Late final text that should not appear")).toBeNull();
  });

  it("tailors quick actions to the district geography (hides lake/mountain actions for inland districts)", () => {
    render(
      <HybridWeatherAdvisor
        weather={makeWeatherBundle({
          district: {
            ...makeWeatherBundle().district,
            id: "bukomansimbi",
            name: "Bukomansimbi",
            slug: "bukomansimbi",
            isLakeVictoriaZone: false,
            lakeZone: undefined,
            hazards: [],
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    expect(screen.queryByRole("button", { name: /Lake wind and launch risk/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Trail and park weather risk/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Safe to farm or dry crops today/i })).toBeInTheDocument();
  });

  it("switches between Online and Offline mode inside the Hybrid Runtime Inspector", async () => {
    render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    const statusBtn = await screen.findByTestId("advisor-runtime-badge");
    fireEvent.click(statusBtn);

    const inspector = screen.getByTestId("advisor-runtime-inspector");
    expect(inspector).not.toHaveTextContent("Remote Config");
    expect(inspector).not.toHaveTextContent("gemini-3.5-flash-lite");

    const offlineBtn = screen.getByRole("button", { name: "Offline" });
    fireEvent.click(offlineBtn);
    expect(offlineBtn).toHaveAttribute("aria-pressed", "true");
    expect(statusBtn).toHaveTextContent("Offline");

    const onlineBtn = screen.getByRole("button", { name: "Online" });
    fireEvent.click(onlineBtn);
    expect(onlineBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders agent-driven dynamic verdict and dynamic follow-up chips without repeating asked questions", async () => {
    mockGenerateHybridWeatherBriefing.mockResolvedValueOnce({
      ok: true,
      data: {
        text: "Low risk of heavy rain tonight in Pallisa District. Rain chances stay between 12% and 27%.",
        source: "cloud",
        model: "gemini-3.5-flash-lite",
        generatedAt: "2026-11-21T17:00:00Z",
        usedCachedWeather: false,
        verdict: {
          level: "go",
          labelEn: "Low storm risk tonight",
          labelLg: "Tewali bulabe bwa muyaga ekiro kino",
          dynamicLabel: "Low storm risk tonight",
        },
        followUps: [
          "Best hours for drying crops tomorrow?",
          "How strong is the wind tomorrow afternoon?",
        ],
      },
    });

    const pallisaBundle = makeWeatherBundle({
      district: {
        ...makeWeatherBundle().district,
        name: "Pallisa",
        slug: "pallisa",
      },
      precipitation: { chance: 82, mm: 0 },
      hourly: [
        { time: "21:00", label: "9 PM", temp: 25, icon: "", kind: "hour", rainChance: 18 },
      ],
    });

    render(<HybridWeatherAdvisor weather={pallisaBundle} />);
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    await waitFor(() => {
      expect(screen.getByTestId("advisor-runtime-badge")).toHaveTextContent("Cloud");
    });

    // Context strip shows current/upcoming hourly rain chance (18%), not full-day peak (82%)
    expect(screen.getByText(/18% ·/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Ask about rain, wind, or travel");
    fireEvent.change(input, { target: { value: "Any storm risk tonight?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const verdictEl = await screen.findByTestId("advisor-verdict-badge");
    expect(verdictEl).toHaveTextContent("Low storm risk tonight");
    expect(verdictEl.className).toContain("text-brand-green");
    expect(verdictEl.className).not.toContain("text-alert-red");

    // Dynamic follow-ups appear and do not repeat "Any storm risk tonight?"
    expect(screen.getByRole("button", { name: "Best hours for drying crops tomorrow?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How strong is the wind tomorrow afternoon?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Any storm risk tonight?" })).toBeNull();
  });

  it("opens the photo dropdown menu and closes only the photo menu when Escape is pressed", async () => {
    render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);
    fireEvent.click(screen.getByTestId("advisor-launcher"));

    const cameraBtn = await screen.findByTestId("advisor-camera-button");
    fireEvent.click(cameraBtn);

    expect(screen.getByRole("menuitem", { name: "Take live photo" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Upload photo" })).toBeInTheDocument();

    // Pressing Escape once closes only the photo menu, keeping the advisor panel open
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menuitem", { name: "Take live photo" })).toBeNull();
    expect(screen.getByText("How can I help with today's weather?")).toBeInTheDocument();
  });

  it("starts the hands free listener after a multi tick streaming reply and cuts in with full history", async () => {
    const listeners: Array<{
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: unknown) => void) | null;
      onend: (() => void) | null;
      ended: boolean;
    }> = [];
    let cancelCalls = 0;

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
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ lang: "en-GB", name: "English", localService: true }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      resume: () => undefined,
      speak: function (this: { speaking: boolean }) {
        this.speaking = true;
      },
      cancel: function (this: { speaking: boolean }) {
        this.speaking = false;
        cancelCalls += 1;
      },
    });

    class FakeSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      ended = false;
      start() {
        listeners.push(this);
      }
      stop() {
        if (this.ended) return;
        this.ended = true;
        this.onend?.();
      }
      abort() {
        this.ended = true;
      }
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeSpeechRecognition);

    let resolveFirstTurn: ((value: unknown) => void) | undefined;
    mockGenerateHybridWeatherBriefing
      .mockImplementationOnce(
        (opts: {
          onPhaseChange?: (phase: "thinking" | "writing") => void;
          onChunk?: (text: string) => void;
        }) => {
          opts.onPhaseChange?.("thinking");
          opts.onPhaseChange?.("writing");
          opts.onChunk?.("Dry skies this morning.");
          return new Promise((resolve) => {
            resolveFirstTurn = resolve;
          });
        },
      )
      .mockResolvedValueOnce({
        ok: true,
        data: {
          text: "Winds stay gentle tomorrow afternoon.",
          source: "cloud",
          model: "gemini-3.5-flash-lite",
          generatedAt: "2026-11-25T09:05:00Z",
          usedCachedWeather: false,
          followUps: ["Any evening rain?"],
        },
      });

    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    localStorage.setItem("uw:gemini-voice-paused-until", String(Date.now() + 60 * 60 * 1000));
    try {
      render(<HybridWeatherAdvisor weather={makeWeatherBundle()} />);
      fireEvent.click(screen.getByTestId("advisor-launcher"));

      const voiceBtn = await screen.findByRole("button", { name: "Speak your question" });
      fireEvent.click(voiceBtn);
      expect(listeners).toHaveLength(1);

      act(() => {
        const first = listeners[0]!;
        first.onresult?.({
          results: [{ isFinal: true, 0: { transcript: "Is it safe to dry crops today" } }],
        });
        first.ended = true;
        first.onend?.();
      });

      // Wait until the busy thinking/writing render has committed so canSend is false.
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
      });

      // Now finish the first reply and verify the during-reply listener still starts.
      await act(async () => {
        resolveFirstTurn?.({
          ok: true,
          data: {
            text: "Dry skies this morning in Kampala.",
            source: "cloud",
            model: "gemini-3.5-flash-lite",
            generatedAt: "2026-11-25T09:00:00Z",
            usedCachedWeather: false,
            followUps: [
              "Will it rain tonight?",
              "How strong is the wind tomorrow afternoon?",
            ],
          },
        });
      });

      await waitFor(() => {
        expect(listeners.some((l) => !l.ended)).toBe(true);
      });

      // Saying "two" cuts in, cancels speech, and sends the second follow-up with Turn 1 history.
      const cancelsBefore = cancelCalls;
      await act(async () => {
        const live = [...listeners].reverse().find((l) => !l.ended)!;
        live.onresult?.({
          results: [{ isFinal: true, 0: { transcript: "two" } }],
        });
        live.ended = true;
        live.onend?.();
      });

      expect(cancelCalls).toBeGreaterThan(cancelsBefore);
      await waitFor(() => {
        expect(mockGenerateHybridWeatherBriefing).toHaveBeenCalledTimes(2);
      });
      expect(mockGenerateHybridWeatherBriefing.mock.calls[1]?.[0]).toMatchObject({
        customQuestion: "How strong is the wind tomorrow afternoon?",
        history: [
          { role: "user", text: "Is it safe to dry crops today" },
          { role: "assistant", text: "Dry skies this morning in Kampala." },
        ],
      });

      // Clicking Stop listening while the second reply plays stops both mic and audio.
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Stop listening" })).toBeInTheDocument();
      });
      const cancelsBeforeStop = cancelCalls;
      fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
      expect(cancelCalls).toBeGreaterThan(cancelsBeforeStop);
      expect(listeners.some((l) => !l.ended)).toBe(false);
    } finally {
      playSpy.mockRestore();
      pauseSpy.mockRestore();
      localStorage.removeItem("uw:gemini-voice-paused-until");
      vi.unstubAllGlobals();
    }
  });
});
