// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_MEASUREMENT_ID = "G-TEST123456";

/** The measurement ID is read when the module loads, so each test sets the
    env var first and then imports a fresh copy of the component. */
async function loadComponent(measurementId: string, analyticsConsent: boolean | null) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", measurementId);
  const { usePreferencesStore } = await import("@/stores/preferencesStore");
  usePreferencesStore.setState({ analyticsConsent, _hasHydrated: true });
  const loaded = await import("./GoogleAnalyticsLoader");
  return loaded.GoogleAnalyticsLoader;
}

describe("GoogleAnalyticsLoader", () => {
  beforeEach(() => {
    const existing = document.getElementById("ga-script");
    if (existing) existing.remove();
    delete window.dataLayer;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("does not load gtag script when consent is null", async () => {
    const GoogleAnalyticsLoader = await loadComponent(TEST_MEASUREMENT_ID, null);
    render(<GoogleAnalyticsLoader />);
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("does not load gtag script when consent is false", async () => {
    const GoogleAnalyticsLoader = await loadComponent(TEST_MEASUREMENT_ID, false);
    render(<GoogleAnalyticsLoader />);
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("loads gtag script and initializes dataLayer when consent is granted", async () => {
    const GoogleAnalyticsLoader = await loadComponent(TEST_MEASUREMENT_ID, true);
    render(<GoogleAnalyticsLoader />);

    const script = document.getElementById("ga-script") as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toContain(`https://www.googletagmanager.com/gtag/js?id=${TEST_MEASUREMENT_ID}`);
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });

  it("stays off when no measurement ID is configured, even with consent", async () => {
    const GoogleAnalyticsLoader = await loadComponent("", true);
    render(<GoogleAnalyticsLoader />);
    expect(document.getElementById("ga-script")).toBeNull();
  });
});
