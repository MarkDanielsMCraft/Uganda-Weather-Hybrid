// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertWidget } from "./AlertWidget";
import type { WeatherAlert } from "@/types/weather";

const mockAlert: WeatherAlert = {
  id: "alert-1",
  severity: "watch",
  title: "Heavy rain with thunder watch",
  description: "Heavy rain with thunder watch over Eastern, Eastern Lowland and Lake Victoria islands.",
  issuedAt: "2026-11-10T12:00:00Z",
  expiresAt: "2026-11-10T18:00:00Z",
  source: "Uganda National Meteorological Authority",
};

let activeAlertsList = [mockAlert];

vi.mock("@/hooks/useActiveAlerts", () => ({
  useActiveAlerts: () => ({
    alerts: activeAlertsList,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useAppLocation", () => ({
  useAppLocation: () => ({
    alertsDistrictSlug: "kampala",
  }),
}));

vi.mock("@/components/sheet/DetailSheetProvider", () => ({
  useDetailSheet: () => ({
    sheet: null,
    openSheet: vi.fn(),
    closeSheet: vi.fn(),
  }),
}));

describe("AlertWidget", () => {
  it("renders with standard WidgetTile header and never displays Advisory", () => {
    activeAlertsList = [mockAlert];
    render(<AlertWidget />);

    expect(screen.getByText("Caution")).toBeInTheDocument();
    expect(screen.queryByText(/advisory/i)).not.toBeInTheDocument();
    expect(screen.getByText("Heavy rain with thunder watch")).toBeInTheDocument();
    expect(screen.queryByText(/WeatherAPI/i)).not.toBeInTheDocument();
  });

  it("renders Warning title for warning severity alerts", () => {
    activeAlertsList = [{ ...mockAlert, severity: "warning" }];
    render(<AlertWidget />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.queryByText(/advisory/i)).not.toBeInTheDocument();
  });

  it("renders nothing when there are no alerts", () => {
    activeAlertsList = [];
    const { container } = render(<AlertWidget />);

    expect(container.firstChild).toBeNull();
  });
});
