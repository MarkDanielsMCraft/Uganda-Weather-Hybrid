// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useWeatherBundle } from "./useWeatherBundle";
import { saveWeatherCache } from "@/lib/offline/weather-cache";
import { usePreferencesStore } from "@/stores/preferencesStore";

function bundle(slug: string, celsius: number) {
  return {
    data: {
      district: { slug, name: "Kampala", region: "central" },
      temperature: { celsius, feelsLike: celsius + 2 },
      dailyForecast: Array.from({ length: 10 }, (_, i) => ({
        day: `Day ${i}`,
        date: `2026-10-${20 + i}`,
        icon: "//cdn.weatherapi.com/day/113.png",
        theme: "clear" as const,
        isToday: i === 0,
        high: celsius + 4,
        low: celsius - 4,
        rainChance: 10,
      })),
      stale: false,
      source: "open-meteo.com",
    },
    meta: { requestId: "r", cachedAt: new Date().toISOString(), stale: false },
  } as never;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWeatherBundle offline fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ _hasHydrated: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the cached bundle instead of nothing when every provider is down", async () => {
    // The server refuses to invent a reading when all its providers fail and
    // answers 503. React Query drops placeholderData once a query errors, so
    // without an explicit fallback a reader with perfectly good cached
    // weather was shown the "Could not load weather" state instead of it.
    saveWeatherCache("kampala", bundle("kampala", 24));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );

    const { result } = renderHook(() => useWeatherBundle("kampala"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.data?.data.temperature.celsius).toBe(24);
  });

  it("marks the fallback stale so the status line does not pass it off as current", async () => {
    saveWeatherCache("kampala", bundle("kampala", 24));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );

    const { result } = renderHook(() => useWeatherBundle("kampala"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.data?.data.stale).toBe(true);
  });

  it("still reports no data when the request fails and nothing was cached", async () => {
    // A first-time reader with no cache must still reach the retry state
    // rather than being shown an empty shell forever.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );

    const { result } = renderHook(() => useWeatherBundle("kampala"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.data).toBeUndefined();
  });

  it("prefers a successful response over the cache", async () => {
    saveWeatherCache("kampala", bundle("kampala", 24));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(bundle("kampala", 31)), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const { result } = renderHook(() => useWeatherBundle("kampala"), { wrapper });

    await waitFor(() => expect(result.current.data?.data.temperature.celsius).toBe(31), { timeout: 8000 });
    expect(result.current.data?.data.stale).toBe(false);
  });
});
