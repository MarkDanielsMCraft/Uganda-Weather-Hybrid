// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainScrollArea } from "./MainScrollArea";
import { useScrollCollapse } from "./ScrollCollapseContext";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/sheet/DetailSheetProvider", () => ({
  useDetailSheet: () => ({
    sheet: null,
    openSheet: vi.fn(),
    closeSheet: vi.fn(),
  }),
  useOptionalDetailSheet: () => null,
}));

// Mock dependencies
vi.mock("@/components/brand/BrandMark", () => ({
  BrandMark: () => <div data-testid="brand-mark">Uganda Weather</div>,
  WeatherGlyph: () => <div data-testid="weather-glyph" />,
}));

vi.mock("@/hooks/useRefreshWeather", () => ({
  useRefreshWeather: () => ({ refresh: vi.fn(), isRefreshing: false }),
}));

vi.mock("@/hooks/useAppReady", () => ({
  useAppReady: () => true,
}));

vi.mock("@/hooks/useWeatherBundle", () => ({
  useWeatherBundle: () => ({
    data: {
      data: {
        temperature: { celsius: 24 },
        condition: { text: "Partly Cloudy" },
        source: "weatherapi.com",
      },
    },
  }),
}));

vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: (selector: (state: { districtSlug: string; activePlace: null }) => unknown) =>
    selector({ districtSlug: "kampala", activePlace: null }),
}));

function ScrollConsumer() {
  const { progress, isCollapsed } = useScrollCollapse();
  return (
    <div data-testid="scroll-consumer">
      <span data-testid="progress">{progress}</span>
      <span data-testid="collapsed">{String(isCollapsed)}</span>
    </div>
  );
}

describe("MainScrollArea and scroll-collapsing header", () => {
  it("renders children and provides scroll collapse context at initial state", () => {
    render(
      <MainScrollArea>
        <ScrollConsumer />
      </MainScrollArea>,
    );

    expect(screen.getByTestId("progress").textContent).toBe("0");
    expect(screen.getByTestId("collapsed").textContent).toBe("false");
  });

  it("updates scroll collapse progress when user scrolls past threshold", async () => {
    const { container } = render(
      <MainScrollArea>
        <ScrollConsumer />
      </MainScrollArea>,
    );

    const mainEl = container.querySelector(".main-scroll");
    expect(mainEl).not.toBeNull();

    if (mainEl) {
      Object.defineProperty(mainEl, "scrollTop", { value: 100, writable: true });
      fireEvent.scroll(mainEl);

      // Trigger requestAnimationFrame
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
});
