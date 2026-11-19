// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CapacitorBootstrap } from "./CapacitorBootstrap";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { requestNativeAppPermissions } from "@/lib/native/startup-permissions";

const isNativeAppMock = vi.fn();
vi.mock("@/lib/native/platform", () => ({
  isNativeApp: () => isNativeAppMock(),
}));

vi.mock("@/lib/native/startup-permissions", () => ({
  requestNativeAppPermissions: vi.fn().mockResolvedValue({
    location: "granted",
    notifications: "granted",
  }),
}));

const splashScreenHideMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: splashScreenHideMock,
  },
}));

const setStyleMock = vi.fn().mockResolvedValue(undefined);
const setBackgroundColorMock = vi.fn().mockResolvedValue(undefined);
const setOverlaysWebViewMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: setStyleMock,
    setBackgroundColor: setBackgroundColorMock,
    setOverlaysWebView: setOverlaysWebViewMock,
  },
  Style: { Dark: "DARK" },
}));

const addListenerMock = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    remove: vi.fn(),
  });
});
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: addListenerMock,
    exitApp: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("CapacitorBootstrap", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
  });

  afterEach(() => {
    delete (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash;
  });

  it("does not invoke native plugins when running on the web", async () => {
    isNativeAppMock.mockResolvedValue(false);

    render(
      <QueryClientProvider client={queryClient}>
        <CapacitorBootstrap />
      </QueryClientProvider>,
    );

    await Promise.resolve();

    expect(splashScreenHideMock).not.toHaveBeenCalled();
    expect(setStyleMock).not.toHaveBeenCalled();
    expect(addListenerMock).not.toHaveBeenCalled();
  });

  it("hides the system SplashScreen and leaves the custom splash for the page when native", async () => {
    isNativeAppMock.mockResolvedValue(true);
    const nativeSplashHideMock = vi.fn();
    (window as unknown as { NativeSplash?: { hide: () => void } }).NativeSplash = {
      hide: nativeSplashHideMock,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <CapacitorBootstrap />
      </QueryClientProvider>,
    );

    // Allow bootstrap promise to complete
    await vi.waitFor(() => {
      expect(splashScreenHideMock).toHaveBeenCalledTimes(1);
    });

    expect(setStyleMock).toHaveBeenCalledTimes(1);
    expect(setBackgroundColorMock).toHaveBeenCalledWith({ color: "#1a1524" });
    expect(setOverlaysWebViewMock).toHaveBeenCalledWith({ overlay: false });
    expect(nativeSplashHideMock).not.toHaveBeenCalled();
    expect(addListenerMock).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
    expect(addListenerMock).toHaveBeenCalledWith("backButton", expect.any(Function));
    expect(addListenerMock).toHaveBeenCalledWith("appStateChange", expect.any(Function));
    await vi.waitFor(() => {
      expect(requestNativeAppPermissions).toHaveBeenCalledWith(expect.any(String));
    });
  });

  it("cleans up listeners on unmount", async () => {
    isNativeAppMock.mockResolvedValue(true);
    const removeListenerMock = vi.fn();
    addListenerMock.mockResolvedValue({
      remove: removeListenerMock,
    });

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <CapacitorBootstrap />
      </QueryClientProvider>,
    );

    await vi.waitFor(() => {
      expect(addListenerMock).toHaveBeenCalled();
    });

    unmount();

    expect(removeListenerMock).toHaveBeenCalledTimes(3);
  });
});
