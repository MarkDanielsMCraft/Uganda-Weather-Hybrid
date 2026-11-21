// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectDeviceUiLanguage, PreferencesBootstrap } from "./PreferencesBootstrap";
import { usePreferencesStore } from "@/stores/preferencesStore";

describe("PreferencesBootstrap device language detection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePreferencesStore.setState({
      uiLanguage: "en",
      hasExplicitLanguageChoice: false,
      _hasHydrated: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("detects Luganda from navigator.languages (lg-UG or lug)", () => {
    vi.stubGlobal("navigator", { languages: ["lg-UG", "en-UG"], language: "lg-UG" });
    expect(detectDeviceUiLanguage()).toBe("lg");

    vi.stubGlobal("navigator", { languages: ["lug"], language: "lug" });
    expect(detectDeviceUiLanguage()).toBe("lg");
  });

  it("auto-switches to Luganda on startup when the device prefers Luganda and user has not chosen manually", async () => {
    vi.stubGlobal("navigator", { languages: ["lg-UG", "en-US"], language: "lg-UG" });
    render(<PreferencesBootstrap />);

    await waitFor(() => {
      expect(usePreferencesStore.getState().uiLanguage).toBe("lg");
    });
    expect(usePreferencesStore.getState().hasExplicitLanguageChoice).toBe(false);
  });

  it("does not override an explicit manual user choice", () => {
    vi.stubGlobal("navigator", { languages: ["lg-UG"], language: "lg-UG" });
    usePreferencesStore.getState().setUiLanguage("en");
    expect(usePreferencesStore.getState().hasExplicitLanguageChoice).toBe(true);

    render(<PreferencesBootstrap />);
    expect(usePreferencesStore.getState().uiLanguage).toBe("en");
  });

  it("syncs language choice and disables lite mode when returning from /lite with ?mode=full&lang=lg", async () => {
    usePreferencesStore.setState({
      uiLanguage: "en",
      hasExplicitLanguageChoice: true,
      liteModePreference: true,
      _hasHydrated: false,
    });
    window.history.replaceState(null, "", "/?mode=full&lang=lg");

    render(<PreferencesBootstrap />);

    await waitFor(() => {
      expect(usePreferencesStore.getState().uiLanguage).toBe("lg");
      expect(usePreferencesStore.getState().liteModePreference).toBe(false);
      expect(window.location.search).toBe("");
    });
  });
});
