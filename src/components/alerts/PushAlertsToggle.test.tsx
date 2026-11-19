// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PushAlertsToggle } from "./PushAlertsToggle";
import { usePreferencesStore } from "@/stores/preferencesStore";

vi.mock("@/lib/native/platform", () => ({
  isNativeApp: vi.fn(),
  nativePlatform: vi.fn().mockResolvedValue("android"),
}));

vi.mock("@/lib/native/push", () => ({
  registerPushNotifications: vi.fn(),
  unregisterPushNotifications: vi.fn(),
}));

import { isNativeApp } from "@/lib/native/platform";
import { registerPushNotifications, unregisterPushNotifications } from "@/lib/native/push";

describe("PushAlertsToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({
      pushAlerts: false,
      pushDeviceToken: null,
      districtSlug: "kampala",
    });
  });

  it("renders on web and explains mobile availability", async () => {
    vi.mocked(isNativeApp).mockResolvedValue(false);
    render(<PushAlertsToggle />);

    await waitFor(() => {
      expect(screen.getByText("Storm alerts")).toBeInTheDocument();
    });

    expect(screen.getByText("Available in the mobile app")).toBeInTheDocument();
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
  });

  it("enables storm alerts in native app", async () => {
    vi.mocked(isNativeApp).mockResolvedValue(true);
    vi.mocked(registerPushNotifications).mockResolvedValue({ ok: true, token: "mock-token-123" });

    render(<PushAlertsToggle />);

    await waitFor(() => {
      expect(screen.getByText("Push warnings for your selected district")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeDisabled();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(registerPushNotifications).toHaveBeenCalledWith("kampala");
      expect(usePreferencesStore.getState().pushAlerts).toBe(true);
      expect(usePreferencesStore.getState().pushDeviceToken).toBe("mock-token-123");
    });
  });

  it("turns off storm alerts when already enabled", async () => {
    vi.mocked(isNativeApp).mockResolvedValue(true);
    usePreferencesStore.setState({
      pushAlerts: true,
      pushDeviceToken: "existing-token",
    });

    render(<PushAlertsToggle />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(unregisterPushNotifications).toHaveBeenCalledWith("existing-token");
      expect(usePreferencesStore.getState().pushAlerts).toBe(false);
      expect(usePreferencesStore.getState().pushDeviceToken).toBeNull();
    });
  });

  it("keeps alerts enabled and reports an error if server unregistration fails", async () => {
    vi.mocked(isNativeApp).mockResolvedValue(true);
    vi.mocked(unregisterPushNotifications).mockRejectedValue(new Error("server unavailable"));
    usePreferencesStore.setState({
      pushAlerts: true,
      pushDeviceToken: "existing-token",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PushAlertsToggle />);
    await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(screen.getByText(/could not turn off storm alerts/i)).toBeInTheDocument();
      expect(usePreferencesStore.getState().pushAlerts).toBe(true);
      expect(usePreferencesStore.getState().pushDeviceToken).toBe("existing-token");
    });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    errorSpy.mockRestore();
  });

  it("recovers from a registration exception and lets the user retry", async () => {
    vi.mocked(isNativeApp).mockResolvedValue(true);
    vi.mocked(registerPushNotifications).mockRejectedValue(new Error("plugin unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PushAlertsToggle />);
    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/could not enable storm alerts/i)).toBeInTheDocument();
      expect(toggle).toBeEnabled();
    });
    expect(usePreferencesStore.getState().pushAlerts).toBe(false);
    expect(usePreferencesStore.getState().pushDeviceToken).toBeNull();
    errorSpy.mockRestore();
  });
});
