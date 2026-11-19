// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UseMyLocationButton } from "./UseMyLocationButton";

const getCurrentCoordinatesMock = vi.fn();

vi.mock("@/lib/native/geolocation", () => ({
  getCurrentCoordinates: () => getCurrentCoordinatesMock(),
}));

vi.mock("@/hooks/useDistrictNavigation", () => ({
  useDistrictNavigation: () => ({
    selectPlace: vi.fn(),
  }),
}));

describe("UseMyLocationButton", () => {
  it("renders inline error message by default when location access is denied", async () => {
    getCurrentCoordinatesMock.mockResolvedValueOnce(null);

    render(<UseMyLocationButton />);
    const button = screen.getByRole("button", { name: /Use my location/i });
    fireEvent.click(button);

    const message = await screen.findByText(
      "Location access is off. Enable it in your browser or device settings.",
    );
    expect(message).toBeDefined();
    expect(message.tagName.toLowerCase()).toBe("p");
  });

  it("renders floating popover and dismisses cleanly when popover prop is true", async () => {
    getCurrentCoordinatesMock.mockResolvedValueOnce(null);

    render(<UseMyLocationButton popover />);
    const button = screen.getByRole("button", { name: /Use my location/i });
    fireEvent.click(button);

    const popoverElement = await screen.findByRole("status");
    expect(popoverElement).toBeDefined();
    expect(popoverElement.textContent).toContain("Location access is off.");

    const dismissButton = screen.getByRole("button", { name: /Dismiss/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

