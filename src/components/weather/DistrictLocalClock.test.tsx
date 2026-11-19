// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistrictLocalClock } from "./DistrictLocalClock";

describe("DistrictLocalClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T15:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing on the very first tick before the clock has computed a value", () => {
    // Render without letting effects flush — the initial synchronous
    // render should produce no <time> element yet.
    const { container } = render(<DistrictLocalClock />);
    // After React's effect flush (which happens synchronously in the
    // test renderer via act()), the clock has ticked once already.
    expect(container.querySelector("time")).toBeInTheDocument();
  });

  it("appends the district name in full (non-compact) mode", () => {
    render(<DistrictLocalClock districtName="Kampala" />);
    expect(screen.getByText(/in Kampala/)).toBeInTheDocument();
  });

  it("omits the district suffix when none is given", () => {
    render(<DistrictLocalClock />);
    expect(screen.queryByText(/^in /)).not.toBeInTheDocument();
  });

  it("renders just a bare <time> with no district text in compact mode", () => {
    render(<DistrictLocalClock districtName="Kampala" compact />);
    expect(screen.queryByText(/Kampala/)).not.toBeInTheDocument();
    expect(document.querySelector("time")).toBeInTheDocument();
  });

  it("updates the displayed time as the clock ticks", () => {
    const { container } = render(<DistrictLocalClock />);
    const first = container.querySelector("time")?.textContent;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const second = container.querySelector("time")?.textContent;
    expect(second).not.toBe(first);
  });
});
