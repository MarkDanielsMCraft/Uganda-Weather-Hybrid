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
});
