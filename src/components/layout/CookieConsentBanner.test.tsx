// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";
import { usePreferencesStore } from "@/stores/preferencesStore";

const isNativeAppMock = vi.fn();
const isNativeAppSyncMock = vi.fn();

vi.mock("@/lib/native/platform", () => ({
  isNativeApp: () => isNativeAppMock(),
  isNativeAppSync: () => isNativeAppSyncMock(),
}));

function renderBanner() {
  return render(
    <DetailSheetProvider>
      <CookieConsentBanner />
    </DetailSheetProvider>,
  );
}

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ analyticsConsent: null });
    isNativeAppMock.mockResolvedValue(false);
    isNativeAppSyncMock.mockReturnValue(false);
  });

  it("never shows the banner inside native mobile apps", async () => {
    isNativeAppMock.mockResolvedValue(true);
    renderBanner();
    await Promise.resolve();
    expect(screen.queryByText(/essential cookies/i)).not.toBeInTheDocument();
  });

  it("never shows the banner when native app is synchronously detected", () => {
    isNativeAppSyncMock.mockReturnValue(true);
    renderBanner();
    expect(screen.queryByText(/essential cookies/i)).not.toBeInTheDocument();
  });

  it("shows the banner on first visit", async () => {
    renderBanner();
    expect(await screen.findByText(/essential cookies/i)).toBeInTheDocument();
  });

  it("stores full consent and hides the banner when accepting all", async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(await screen.findByRole("button", { name: "Accept all" }));

    await waitFor(() => {
      expect(screen.queryByText(/essential cookies/i)).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("uw:cookie-consent")).toBe("accepted");
    expect(usePreferencesStore.getState().analyticsConsent).toBe(true);
  });

  it("records essential-only consent and never grants analytics when declined", async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(await screen.findByRole("button", { name: "Essential only" }));

    await waitFor(() => {
      expect(screen.queryByText(/essential cookies/i)).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("uw:cookie-consent")).toBe("essential-only");
    expect(usePreferencesStore.getState().analyticsConsent).toBe(false);
  });

  it("stays hidden on a later visit once consent was already recorded", () => {
    localStorage.setItem("uw:cookie-consent", "accepted");
    renderBanner();
    expect(screen.queryByText(/essential cookies/i)).not.toBeInTheDocument();
  });

  it("opens the Privacy sheet in place instead of navigating", async () => {
    const user = userEvent.setup();
    renderBanner();

    await user.click(await screen.findByRole("button", { name: "Privacy" }));
    expect(
      await screen.findByRole("dialog", { name: "Privacy" }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
