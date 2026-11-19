// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundView } from "@/components/layout/NotFoundView";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";
import { usePreferencesStore } from "@/stores/preferencesStore";

vi.mock("@/components/layout/WeatherBackdrop", () => ({
  WeatherBackdrop: () => <div data-testid="weather-backdrop" />,
}));

vi.mock("@/components/layout/TopBar", () => ({
  TopBar: () => <div data-testid="top-bar" />,
}));

vi.mock("@/components/layout/AppFooter", () => ({
  AppFooter: () => <footer data-testid="app-footer" />,
}));

describe("NotFoundView", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      uiLanguage: "en",
      districtSlug: "kampala",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders English copy, navigation actions, and major district links without technical status codes", () => {
    render(
      <DetailSheetProvider>
        <NotFoundView />
      </DetailSheetProvider>,
    );

    expect(screen.queryByText("404")).toBeNull();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home forecast" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Search places" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.getByRole("link", { name: "Kampala" })).toHaveAttribute(
      "href",
      "/district/kampala",
    );
  });

  it("renders localized Luganda 404 copy when uiLanguage is lg", () => {
    usePreferencesStore.setState({ uiLanguage: "lg" });

    render(
      <DetailSheetProvider>
        <NotFoundView />
      </DetailSheetProvider>,
    );

    expect(screen.getByRole("heading", { name: "Olupapula terulabise" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ddayo ku lupapula olusooka" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Noonya ekifo" })).toHaveAttribute(
      "href",
      "/search",
    );
  });
});
