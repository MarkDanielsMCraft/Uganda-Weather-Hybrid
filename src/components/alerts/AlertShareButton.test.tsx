// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertShareButton } from "./AlertShareButton";
import type { WeatherAlert } from "@/types/weather";

const alert: WeatherAlert = {
  id: "abc123",
  title: "Flood Warning",
  description: "Heavy rain expected",
  severity: "warning",
  source: "UNMA",
  issuedAt: new Date().toISOString(),
};

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("AlertShareButton", () => {
  it("copies the absolute alert link to the clipboard and shows confirmation", async () => {
    // userEvent.setup() installs its own navigator.clipboard mock, so ours
    // must be applied after (or it gets silently overwritten and the spy
    // never sees the call, even though the UI still updates correctly via
    // userEvent's own clipboard emulation).
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<AlertShareButton alert={alert} districtSlug="kampala" />);

    await user.click(screen.getByRole("button", { name: "Copy alert link" }));

    // The label only flips to "copied" once writeText's promise has
    // resolved, so waiting for the label is sufficient — no separate
    // wait-for-the-mock-call race needed.
    expect(await screen.findByRole("button", { name: "Alert link copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/alerts?district=kampala&alert=abc123`,
    );
  });

  it("reverts to the default label after the confirmation window", async () => {
    stubClipboard();
    vi.useFakeTimers();
    try {
      render(<AlertShareButton alert={alert} districtSlug="kampala" />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy alert link" }));
        // Flush the clipboard promise's microtask.
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: "Alert link copied" })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByRole("button", { name: "Copy alert link" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
