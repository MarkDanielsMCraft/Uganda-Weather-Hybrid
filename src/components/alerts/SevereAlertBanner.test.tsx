// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";

const { useActiveAlertsMock } = vi.hoisted(() => ({ useActiveAlertsMock: vi.fn() }));

vi.mock("@/hooks/useActiveAlerts", () => ({ useActiveAlerts: useActiveAlertsMock }));
vi.mock("@/hooks/useAppLocation", () => ({
  useAppLocation: () => ({ alertsDistrictSlug: "kampala" }),
}));

const { SevereAlertBanner } = await import("./SevereAlertBanner");

function renderBanner() {
  return render(
    <DetailSheetProvider>
      <SevereAlertBanner />
    </DetailSheetProvider>,
  );
}

function alert(
  overrides: Partial<{
    severity: "advisory" | "watch" | "warning" | "extreme";
    title: string;
    description: string;
  }> = {},
) {
  return {
    id: "1",
    title: "Storm approaching",
    description: "desc",
    severity: "warning" as const,
    source: "UNMA",
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("SevereAlertBanner", () => {
  it("renders nothing when there are no alerts at all", () => {
    useActiveAlertsMock.mockReturnValue({ alerts: [] });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when alerts exist but none are extreme or warning severity", () => {
    useActiveAlertsMock.mockReturnValue({
      alerts: [alert({ severity: "advisory" }), alert({ severity: "watch" })],
    });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("surfaces the first extreme/warning alert and expands full detail in place on click, without navigating", async () => {
    useActiveAlertsMock.mockReturnValue({
      alerts: [
        alert({ severity: "advisory" }),
        alert({ severity: "extreme", title: "Flash flood", description: "Rivers may overflow." }),
      ],
    });
    renderBanner();

    expect(screen.getByText("Flash flood")).toBeInTheDocument();
    expect(screen.getByText("Extreme")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /flash flood/i });
    await userEvent.click(trigger);

    // `findBy`, not `getBy`: the detail sheet is code split and loads on
    // first open, so it mounts a tick after the click rather than during it.
    expect(await screen.findByRole("dialog", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Rivers may overflow.")).toBeInTheDocument();
  });
});
