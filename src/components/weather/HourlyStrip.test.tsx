// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HourlyStrip, prepareDisplayHourly } from "./HourlyStrip";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import { parseUgandaLocalTime } from "@/lib/time/uganda";

describe("HourlyStrip", () => {
  it("renders hourly items and summary", () => {
    const weather = makeWeatherBundle();
    render(
      <DetailSheetProvider>
        <HourlyStrip weather={weather} />
      </DetailSheetProvider>,
    );

    expect(screen.getByText("Now")).toBeInTheDocument();
  });

  it("preserves native vertical page scrolling without hijacking wheel events", () => {
    const weather = makeWeatherBundle();
    const { container } = render(
      <DetailSheetProvider>
        <HourlyStrip weather={weather} />
      </DetailSheetProvider>,
    );

    const track = container.querySelector(".overflow-x-auto") as HTMLDivElement;
    expect(track).not.toBeNull();

    // Mock scroll dimensions
    Object.defineProperty(track, "scrollWidth", { value: 1000, configurable: true });
    Object.defineProperty(track, "clientWidth", { value: 400, configurable: true });
    track.scrollLeft = 0;

    fireEvent.wheel(track, { deltaY: 80, deltaX: 0 });
    // scrollLeft must remain 0, allowing normal vertical page scroll
    expect(track.scrollLeft).toBe(0);
  });

  it("handles mouse dragging to scroll horizontally without firing item click", () => {
    const weather = makeWeatherBundle();
    const { container } = render(
      <DetailSheetProvider>
        <HourlyStrip weather={weather} />
      </DetailSheetProvider>,
    );

    const track = container.querySelector(".overflow-x-auto") as HTMLDivElement;
    expect(track).not.toBeNull();

    let scrollLeftVal = 0;
    Object.defineProperty(track, "scrollLeft", {
      get: () => scrollLeftVal,
      set: (v) => {
        scrollLeftVal = v;
      },
      configurable: true,
    });

    // Start mouse down at clientX=100
    fireEvent.mouseDown(track, { clientX: 100, pageX: 100, button: 0 });
    // Drag to clientX=60 (drag of 40px leftwards, so scrollLeft increases by 40)
    fireEvent.mouseMove(window, { clientX: 60, pageX: 60 });
    expect(track.scrollLeft).toBe(40);

    // Mouse up on window
    fireEvent.mouseUp(window);

    // Clicking an hour button after dragging does not open the detail sheet
    const nowButton = screen.getByRole("button", { name: /Now/i });
    fireEvent.click(nowButton);

    // The detail sheet dialog should not be rendered
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("folds a duplicate current-hour entry into Now when the clock has crossed the hour boundary", () => {
    const weather = makeWeatherBundle({
      localTime: "2026-11-08 01:45",
      hourly: [
        {
          time: "2026-11-08 01:45",
          label: "Now",
          temp: 18,
          icon: "//cdn.weatherapi.com/night/116.png",
          kind: "hour",
          rainChance: 67,
        },
        {
          time: "2026-11-08 02:00",
          label: "2 am",
          temp: 18,
          icon: "//cdn.weatherapi.com/night/116.png",
          kind: "hour",
          rainChance: 24,
        },
        {
          time: "2026-11-08 03:00",
          label: "3 am",
          temp: 18,
          icon: "//cdn.weatherapi.com/night/116.png",
          kind: "hour",
          rainChance: 65,
        },
      ],
    });

    const twoAmPlus52SecMs = parseUgandaLocalTime("2026-11-08 02:00").getTime() + 52_000;
    const display = prepareDisplayHourly(weather, twoAmPlus52SecMs);

    expect(display.map((point) => point.label)).toEqual(["Now", "3 am"]);
    expect(display[0].rainChance).toBe(24);
  });

  it("injects sunrise and sunset markers from astronomy when missing in the hourly array", () => {
    const weather = makeWeatherBundle({
      astronomy: {
        sunrise: "06:50 AM",
        sunset: "06:58 PM",
        moonPhase: "Waxing Gibbous",
        moonIllumination: 60,
      },
      hourly: [
        { time: "2026-11-08 05:00", label: "Now", temp: 17, icon: "", kind: "hour" },
        { time: "2026-11-08 06:00", label: "6 am", temp: 18, icon: "", kind: "hour" },
        { time: "2026-11-08 07:00", label: "7 am", temp: 18, icon: "", kind: "hour" },
        { time: "2026-11-08 18:00", label: "6 pm", temp: 23, icon: "", kind: "hour" },
        { time: "2026-11-08 19:00", label: "7 pm", temp: 19, icon: "", kind: "hour" },
      ],
    });

    const display = prepareDisplayHourly(
      weather,
      parseUgandaLocalTime("2026-11-08 05:10").getTime(),
    );

    expect(display.some((point) => point.kind === "sunrise" && point.label === "6:50 am")).toBe(true);
    expect(display.some((point) => point.kind === "sunset" && point.label === "6:58 pm")).toBe(true);
  });
});
