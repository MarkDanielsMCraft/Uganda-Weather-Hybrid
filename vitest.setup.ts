import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no ResizeObserver — DetailSheet (and anything using it) needs
// one to exist, even as a no-op, since real layout measurement isn't
// meaningful in a headless DOM test anyway.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom also has no matchMedia — useIsLgUp (and anything that renders
// DetailSheet, which reads it to pick desktop vs. mobile layout) needs it.
// Defaults to "not matched" (mobile/narrow), which is the safer default for
// tests that don't care about breakpoint behaviour specifically.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  cleanup();
});
