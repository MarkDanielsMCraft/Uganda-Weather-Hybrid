// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WindCompass } from "./WindWidget";
import { formatDmsCoordinates } from "./WindCompass";

describe("WindCompass", () => {
  const rotation = (deg: number) =>
    deg === 0 ? "transform: rotate(0deg)" : `transform: rotate(${-deg}deg)`;

  it("renders 0 degrees North correctly", () => {
    render(<WindCompass degree={0} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(0));
  });

  it("wraps 360 degrees boundary to 0 degrees North", () => {
    render(<WindCompass degree={360} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(0));
  });

  it("wraps angles beyond 360 degrees correctly", () => {
    render(<WindCompass degree={450} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(90));
  });

  it("wraps negative degrees correctly", () => {
    render(<WindCompass degree={-90} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(270));
  });

  it("safely handles NaN degree by falling back to 0 degrees North", () => {
    render(<WindCompass degree={NaN} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(0));
  });

  it("safely handles Infinity degree by falling back to 0 degrees North", () => {
    render(<WindCompass degree={Infinity} />);
    expect(screen.getByTestId("wind-compass-needle")).toHaveStyle(rotation(0));
  });

  it("shows the exact bearing and compass point in the center", () => {
    render(<WindCompass degree={286} />);
    expect(screen.getByTestId("wind-compass-degree")).toHaveTextContent("286°");
    expect(screen.getByText("WNW")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Wind from 286 degrees, WNW" })).toBeInTheDocument();
  });

  it("adds 30 degree numerals only on large dials", () => {
    const { unmount } = render(<WindCompass degree={10} size={96} />);
    expect(screen.queryByText("330")).not.toBeInTheDocument();
    unmount();
    render(<WindCompass degree={10} size={220} />);
    expect(screen.getByText("330")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("handles custom positive size and negative size fallback", () => {
    const { container: customContainer } = render(<WindCompass degree={180} size={80} />);
    expect(customContainer.firstChild).toHaveStyle("height: 80px; width: 80px;");

    const { container: fallbackContainer } = render(<WindCompass degree={180} size={-50} />);
    expect(fallbackContainer.firstChild).toHaveStyle("height: 96px; width: 96px;");
  });
});

describe("formatDmsCoordinates", () => {
  it("formats Kampala coordinates in DMS format", () => {
    // 0.3476° N, 32.5825° E
    const formatted = formatDmsCoordinates(0.3476, 32.5825);
    expect(formatted).toBe("0°20'51\" N  32°34'57\" E");
  });

  it("handles southern and western hemispheres", () => {
    const formatted = formatDmsCoordinates(-1.25, -30.5);
    expect(formatted).toBe("1°15'0\" S  30°30'0\" W");
  });

  it("handles invalid or non-finite inputs", () => {
    expect(formatDmsCoordinates(NaN, 32.5)).toBe("");
    expect(formatDmsCoordinates(0.3, Infinity)).toBe("");
  });
});

describe("beaufortForce", () => {
  it("maps wind speed accurately across the Beaufort scale", async () => {
    const { beaufortForce } = await import("./WindDetailContent");

    expect(beaufortForce(0).force).toBe(0); // Calm
    expect(beaufortForce(1).label).toBe("Calm");
    expect(beaufortForce(4).force).toBe(1); // Light air
    expect(beaufortForce(10).force).toBe(2); // Light breeze
    expect(beaufortForce(15).force).toBe(3); // Gentle breeze
    expect(beaufortForce(25).force).toBe(4); // Moderate breeze
    expect(beaufortForce(35).force).toBe(5); // Fresh breeze
    expect(beaufortForce(45).force).toBe(6); // Strong breeze
    expect(beaufortForce(55).force).toBe(7); // High wind
    expect(beaufortForce(70).force).toBe(8); // Gale
    expect(beaufortForce(80).force).toBe(9); // Strong gale
    expect(beaufortForce(95).force).toBe(10); // Storm
    expect(beaufortForce(110).force).toBe(11); // Violent storm
    expect(beaufortForce(130).force).toBe(12); // Hurricane-force
  });

  it("safely maps NaN and negative speeds to Calm (force 0) instead of Hurricane-force", async () => {
    const { beaufortForce } = await import("./WindDetailContent");

    expect(beaufortForce(NaN).force).toBe(0);
    expect(beaufortForce(NaN).label).toBe("Calm");
    expect(beaufortForce(-10).force).toBe(0);
    expect(beaufortForce(-10).label).toBe("Calm");
  });
});

describe("degreesToCompass", () => {
  it("maps negative degrees and wrapping angles accurately", async () => {
    const { degreesToCompass } = await import("@/lib/weather/wmo");

    expect(degreesToCompass(0)).toBe("N");
    expect(degreesToCompass(360)).toBe("N");
    expect(degreesToCompass(90)).toBe("E");
    expect(degreesToCompass(180)).toBe("S");
    expect(degreesToCompass(270)).toBe("W");
    // Negative angles
    expect(degreesToCompass(-90)).toBe("W");
    expect(degreesToCompass(-180)).toBe("S");
    expect(degreesToCompass(-270)).toBe("E");
    // Wrapping angles
    expect(degreesToCompass(450)).toBe("E");
    // NaN fallback
    expect(degreesToCompass(NaN)).toBe("N");
  });
});
