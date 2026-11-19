// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  IconSun,
  IconPartlyCloudy,
  IconCloudy,
  IconRain,
  IconThunder,
  IconFog,
  IconMoon,
  IconHaze,
  IconSunrise,
  IconSunset,
  IconWind,
  WeatherThemeIcon,
  CONTINUOUS_CLOUD_PATH,
} from "./weather-icons";

describe("weather-icons multicolor vector suite", () => {
  it("exports a continuous cubic Bezier cloud contour without composite seams", () => {
    expect(CONTINUOUS_CLOUD_PATH).toBeDefined();
    expect(CONTINUOUS_CLOUD_PATH).toContain("M 8.0 24.0");
    expect(CONTINUOUS_CLOUD_PATH).toContain("Z");
  });

  it("renders IconSun with golden rays and custom size", () => {
    const { container } = render(<IconSun size={32} className="sun-test" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg?.classList.contains("sun-test")).toBe(true);
    expect(container.querySelectorAll("circle").length).toBe(1);
    expect(container.querySelectorAll("rect").length).toBe(8);
  });

  it("renders IconMoon with pale silver moon and 4-point sparkle stars", () => {
    const { container } = render(<IconMoon size={28} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg?.getAttribute("width")).toBe("28");
    expect(container.querySelectorAll("path").length).toBe(3);
  });

  it("renders IconFog with continuous cloud path and full-width mist bars", () => {
    const { container } = render(<IconFog size={24} />);
    const path = container.querySelector("path");
    expect(path).toBeDefined();
    expect(path?.getAttribute("d")).toBe(CONTINUOUS_CLOUD_PATH);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(2); // 2 mist bars
  });

  it("renders IconCloudy with monolithic continuous Bezier contour", () => {
    const { container } = render(<IconCloudy size={26} />);
    const path = container.querySelector("path");
    expect(path).toBeDefined();
    expect(path?.getAttribute("d")).toBe(CONTINUOUS_CLOUD_PATH);
  });

  it("renders IconRain with continuous cloud and vertically staggered slanting drops", () => {
    const { container } = render(<IconRain size={28} />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe(CONTINUOUS_CLOUD_PATH);
    const drops = container.querySelectorAll("rect");
    expect(drops.length).toBe(3); // 3 slanted drops
  });

  it("renders IconThunder with electric yellow bolt and negative-space knockout mask", () => {
    const { container } = render(<IconThunder size={28} />);
    const mask = container.querySelector("mask");
    expect(mask).toBeDefined();
    const polygon = container.querySelector("polygon");
    expect(polygon).toBeDefined();
    const drops = container.querySelectorAll("rect");
    // 1 mask rect + 2 drops
    expect(drops.length).toBe(3);
  });

  it("renders IconPartlyCloudy with upper-left sun and knockout mask", () => {
    const { container } = render(<IconPartlyCloudy size={28} />);
    const mask = container.querySelector("mask");
    expect(mask).toBeDefined();
    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("cx")).toBe("10.5");
    expect(circle?.getAttribute("cy")).toBe("11.2");
  });

  it("renders IconHaze with golden sun and staggered mist lines", () => {
    const { container } = render(<IconHaze size={24} />);
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelector("circle")).toBeDefined();
  });

  it("renders IconSunrise with horizon line and upward chevron", () => {
    const { container } = render(<IconSunrise size={24} />);
    expect(container.querySelectorAll("rect").length).toBe(6); // 5 rays + 1 horizon line
    expect(container.querySelector("path")).toBeDefined();
  });

  it("renders IconSunset with horizon line and downward chevron", () => {
    const { container } = render(<IconSunset size={24} />);
    expect(container.querySelectorAll("rect").length).toBe(6); // 5 rays + 1 horizon line
    expect(container.querySelector("path")).toBeDefined();
  });

  it("renders IconWind with heavy stroke and loop ribbons", () => {
    const { container } = render(<IconWind size={24} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(3);
    expect(paths[0].getAttribute("stroke-width")).toBe("2.4");
  });

  it("maps every WeatherTheme cleanly through WeatherThemeIcon", () => {
    const themes = ["clear", "partly_cloudy", "cloudy", "rain", "thunder", "fog", "night"] as const;
    for (const theme of themes) {
      const { container } = render(<WeatherThemeIcon theme={theme} size={24} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeDefined();
    }
  });

  it("applies micro-animation CSS classes when animated is true", () => {
    const { container: sunContainer } = render(<IconSun size={24} animated />);
    expect(sunContainer.querySelector(".animate-sun-rays")).not.toBeNull();

    const { container: cloudContainer } = render(<IconCloudy size={24} animated />);
    expect(cloudContainer.querySelector(".animate-cloud-float")).not.toBeNull();

    const { container: rainContainer } = render(<IconRain size={24} animated />);
    expect(rainContainer.querySelector(".animate-rain-drop-1")).not.toBeNull();
    expect(rainContainer.querySelector(".animate-rain-drop-2")).not.toBeNull();
    expect(rainContainer.querySelector(".animate-rain-drop-3")).not.toBeNull();

    const { container: thunderContainer } = render(<IconThunder size={24} animated />);
    expect(thunderContainer.querySelector(".animate-lightning")).not.toBeNull();
  });

  it("omits micro-animation CSS classes when animated is false", () => {
    const { container: sunContainer } = render(<IconSun size={24} animated={false} />);
    expect(sunContainer.querySelector(".animate-sun-rays")).toBeNull();

    const { container: cloudContainer } = render(<IconCloudy size={24} animated={false} />);
    expect(cloudContainer.querySelector(".animate-cloud-float")).toBeNull();

    const { container: rainContainer } = render(<IconRain size={24} animated={false} />);
    expect(rainContainer.querySelector(".animate-rain-drop-1")).toBeNull();

    const { container: thunderContainer } = render(<IconThunder size={24} animated={false} />);
    expect(thunderContainer.querySelector(".animate-lightning")).toBeNull();
  });
});
