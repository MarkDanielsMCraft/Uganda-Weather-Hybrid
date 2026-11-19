// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { GoogleAnalyticsLoader } from "./GoogleAnalyticsLoader";
import { usePreferencesStore } from "@/stores/preferencesStore";

describe("GoogleAnalyticsLoader", () => {
  beforeEach(() => {
    const existing = document.getElementById("ga-script");
    if (existing) existing.remove();
    delete window.dataLayer;
    usePreferencesStore.setState({ analyticsConsent: null, _hasHydrated: true });
  });

  it("does not load gtag script when consent is null", () => {
    render(<GoogleAnalyticsLoader />);
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("does not load gtag script when consent is false", () => {
    usePreferencesStore.setState({ analyticsConsent: false, _hasHydrated: true });
    render(<GoogleAnalyticsLoader />);
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("loads gtag script and initializes dataLayer when consent is granted", () => {
    usePreferencesStore.setState({ analyticsConsent: true, _hasHydrated: true });
    render(<GoogleAnalyticsLoader />);

    const script = document.getElementById("ga-script") as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toContain("https://www.googletagmanager.com/gtag/js?id=G-RDD9SSRHF3");
    expect(window.dataLayer).toBeDefined();
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });
});

