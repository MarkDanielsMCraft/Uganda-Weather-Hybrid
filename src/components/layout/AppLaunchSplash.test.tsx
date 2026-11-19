// @vitest-environment jsdom
import { render, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AppLaunchSplash } from "./AppLaunchSplash";

describe("AppLaunchSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders splash initially and invokes NativeSplash.hide after 2000ms", () => {
    const hideMock = vi.fn();
    (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash = {
      hide: hideMock,
    };

    const { container } = render(<AppLaunchSplash />);
    expect(container.querySelector("img")).toBeInTheDocument();

    // Advance 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(hideMock).toHaveBeenCalledTimes(1);

    // Advance 350ms for fade out
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(container.firstChild).toBeNull();

    delete (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash;
  });

  it("bypasses splash completely on web outside native shells to protect Core Web Vitals", () => {
    // In standard web environment without NativeSplash or native bridge
    const { container } = render(<AppLaunchSplash />);
    expect(container.firstChild).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up launch timer if unmounted before 2000ms delay in native shell", () => {
    (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash = {
      hide: vi.fn(),
    };
    const { unmount } = render(<AppLaunchSplash />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    delete (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash;
  });

  it("cleans up all timers if unmounted during fade in native shell", () => {
    (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash = {
      hide: vi.fn(),
    };
    const { unmount } = render(<AppLaunchSplash />);

    // Advance 2000ms to start fading
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Unmount during the 350ms fading window
    unmount();

    // Verify all timers are cleanly cancelled on unmount
    expect(vi.getTimerCount()).toBe(0);

    // Advance past the 350ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    delete (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash;
  });
});
