// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CityChipsTrack } from "./CityChipsTrack";

const selectDistrictMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      { slug: "wakiso", tempC: 29, icon: "https://example.com/sun.png", theme: "clear" },
      { slug: "kampala", tempC: 24, icon: "https://example.com/cloud.png", theme: "cloudy" },
    ],
  }),
}));

vi.mock("@/hooks/useAppReady", () => ({
  useAppReady: () => true,
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useIsLgUp: () => true,
}));

vi.mock("@/hooks/useDistrictNavigation", () => ({
  useDistrictNavigation: () => ({
    selectDistrict: selectDistrictMock,
  }),
}));

vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: (selector: (state: { districtSlug: string; activePlace: null }) => unknown) =>
    selector({ districtSlug: "wakiso", activePlace: null }),
}));

vi.mock("@/hooks/useWeatherBundle", () => ({
  useWeatherBundle: (slug: string) => {
    if (slug === "wakiso") {
      return {
        data: {
          data: {
            temperature: { celsius: 25 },
            condition: { text: "Chance of Rain", icon: "https://example.com/rain.png", theme: "rain" },
          },
        },
      };
    }
    return { data: undefined };
  },
}));

describe("CityChipsTrack", () => {
  it("synchronizes the active district chip with the live weather bundle", () => {
    render(<CityChipsTrack />);

    // Even though the chip query returned 29° for wakiso, the active chip must
    // synchronize with the live weather bundle's 25°
    const wakisoButtons = screen.getAllByRole("button", { name: /Wakiso/i });
    expect(wakisoButtons.length).toBeGreaterThan(0);
    expect(wakisoButtons[0].textContent).toContain("Wakiso");
    expect(wakisoButtons[0].textContent).toContain("25°");
    expect(wakisoButtons[0].textContent).not.toContain("29°");
  });
});

