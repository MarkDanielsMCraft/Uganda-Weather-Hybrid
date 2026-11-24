// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefetchVoiceClip = vi.fn();

vi.mock("@/lib/ai/advisor-voice", () => ({
  fetchVoiceCapabilities: vi.fn().mockResolvedValue({
    lugandaTts: true,
    lugandaStt: false,
    englishNeuralTts: true,
  }),
  isVoiceOutputSupported: () => true,
  prefetchVoiceClip: (...args: unknown[]) => prefetchVoiceClip(...args),
  speakAdvisorReply: vi.fn(),
  stopVoiceOutput: vi.fn(),
}));

import { LiteListenButton } from "@/components/settings/LiteListenButton";

describe("LiteListenButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchVoiceClip.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not request paid cloud speech just because the page loaded", async () => {
    render(<LiteListenButton spokenTextEn="Rain likely today." spokenTextLg="" language="en" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(prefetchVoiceClip).not.toHaveBeenCalled();
  });

  it("starts loading speech as soon as the user touches the Listen button", async () => {
    render(<LiteListenButton spokenTextEn="Rain likely today." spokenTextLg="" language="en" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    fireEvent.pointerDown(screen.getByRole("button"));

    expect(prefetchVoiceClip).toHaveBeenCalledTimes(1);
    expect(prefetchVoiceClip).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Rain likely today.", language: "en" }),
    );
  });
});
