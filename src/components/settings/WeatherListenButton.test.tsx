// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import { saveWeatherCache } from "@/lib/offline/weather-cache";
import { usePreferencesStore } from "@/stores/preferencesStore";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const speakAdvisorReplyMock = vi.fn().mockReturnValue(true);
const stopVoiceOutputMock = vi.fn();
const prefetchVoiceClipMock = vi.fn();

vi.mock("@/lib/ai/advisor-voice", () => ({
  fetchVoiceCapabilities: vi.fn().mockResolvedValue({
    lugandaTts: true,
    lugandaStt: false,
    englishNeuralTts: true,
  }),
  isVoiceOutputSupported: () => true,
  prefetchVoiceClip: (...args: unknown[]) => prefetchVoiceClipMock(...args),
  primeVoicePlaybackForGesture: vi.fn(),
  speakAdvisorReply: (...args: unknown[]) => speakAdvisorReplyMock(...args),
  stopVoiceOutput: (...args: unknown[]) => stopVoiceOutputMock(...args),
}));

import {
  resetWeatherListenAutoNarrateForTests,
  WeatherListenButton,
} from "@/components/settings/WeatherListenButton";

function makeTenDayBundle(slug = "kampala", name = "Kampala") {
  const bundle = makeWeatherBundle();
  bundle.district = { ...bundle.district, slug, name };
  const sampleDay = bundle.dailyForecast[0]!;
  bundle.dailyForecast = Array.from({ length: 10 }, (_, idx) => ({
    ...sampleDay,
    day: idx === 0 ? "Today" : `Day ${idx + 1}`,
  }));
  return bundle;
}

describe("WeatherListenButton", () => {
  beforeEach(() => {
    mockPathname = "/";
    speakAdvisorReplyMock.mockClear();
    stopVoiceOutputMock.mockClear();
    prefetchVoiceClipMock.mockClear();
    resetWeatherListenAutoNarrateForTests();
    usePreferencesStore.setState({
      districtSlug: "kampala",
      activePlace: null,
      uiLanguage: "lg",
      voiceMode: false,
    });
    saveWeatherCache("kampala", {
      data: makeTenDayBundle("kampala", "Kampala"),
      meta: { requestId: "req-kampala", cachedAt: "2026-11-26T18:00:00Z" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("speaks live sheet DOM text once on click without self-aborting when voiceMode turns on", async () => {
    const sunsetCardText =
      "Enjuba okugwa. Enjuba egudde leero. Enjuba bw'evaayo. 12:43 ezokumakya.";

    render(
      <>
        <WeatherListenButton compact testId="header-listen" />
        <WeatherListenButton
          compact
          tileIdOverride="r1 Enjuba okugwa"
          spokenTextOverride={sunsetCardText}
          getLiveSpokenText={() => sunsetCardText}
          autoNarrateOnSheetChange
          testId="sheet-listen-toggle"
        />
      </>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const sheetBtn = screen.getByTestId("sheet-listen-toggle");
    expect(sheetBtn.className).toContain("bg-white/10");

    await act(async () => {
      fireEvent.click(sheetBtn);
    });

    expect(speakAdvisorReplyMock).toHaveBeenCalledTimes(1);
    expect(speakAdvisorReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: sunsetCardText,
        language: "lg",
      }),
    );
    expect(sheetBtn.className).toContain("bg-brand-green/75");
  });

  it("resolves /lg/district/[slug] URL district immediately before store hydration", async () => {
    mockPathname = "/lg/district/gulu";
    saveWeatherCache("gulu", {
      data: makeTenDayBundle("gulu", "Gulu"),
      meta: { requestId: "req-gulu", cachedAt: "2026-11-26T18:00:00Z" },
    });

    render(<WeatherListenButton compact testId="district-listen" />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId("district-listen"));

    expect(speakAdvisorReplyMock).toHaveBeenCalledTimes(1);
    expect(speakAdvisorReplyMock.mock.calls[0]?.[0]?.text).toContain("Gulu");
    expect(speakAdvisorReplyMock.mock.calls[0]?.[0]?.text).not.toContain("Kampala");
  });
});
