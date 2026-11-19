// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DetailSheet } from "./DetailSheet";
import { DetailSheetProvider, type SheetState } from "./DetailSheetProvider";
import { WidgetTile } from "@/components/glass/WidgetTile";

describe("DetailSheet", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders content and handles Escape key dismissal", () => {
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const sheetState: SheetState = {
      tileId: "test-tile",
      title: "Test Sheet",
      anchorEl: anchor,
      content: <div>Sheet Body Content</div>,
    };

    const { rerender } = render(<DetailSheet sheet={sheetState} onClose={onClose} />);

    expect(screen.getByText("Test Sheet")).toBeInTheDocument();
    expect(screen.getByText("Sheet Body Content")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Dismiss by close button
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<DetailSheet sheet={null} onClose={onClose} />);
  });

  it("renders backdrop and clicks backdrop to close", () => {
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const sheetState: SheetState = {
      tileId: "test-tile",
      title: "Test Sheet",
      anchorEl: anchor,
      content: <div>Sheet Body Content</div>,
    };

    render(<DetailSheet sheet={sheetState} onClose={onClose} />);

    const backdrop = document.querySelector(".fixed.inset-0.z-40");
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("locks body and main scroll container overflow when opened", () => {
    const onClose = vi.fn();
    const scrollContainer = document.createElement("main");
    scrollContainer.className = "main-scroll";
    scrollContainer.style.overflow = "auto";
    document.body.appendChild(scrollContainer);

    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const sheetState: SheetState = {
      tileId: "lock-tile",
      title: "Lock Test",
      anchorEl: anchor,
      content: <div>Body</div>,
    };

    const { rerender } = render(<DetailSheet sheet={sheetState} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(scrollContainer.style.overflow).toBe("hidden");

    rerender(<DetailSheet sheet={null} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("");
    expect(scrollContainer.style.overflow).toBe("auto");
  });

  it("closes when the user pulls strongly from top downwards inside the card body", () => {
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const sheetState: SheetState = {
      tileId: "pull-tile",
      title: "Pull Test",
      anchorEl: anchor,
      content: <div>Pullable Card Content</div>,
    };

    render(<DetailSheet sheet={sheetState} onClose={onClose} />);
    const bodyText = screen.getByText("Pullable Card Content");

    // Normal upward finger movement (scrolling down to read content) must not close
    fireEvent.touchStart(bodyText, { touches: [{ clientX: 120, clientY: 300 }] });
    fireEvent.touchMove(bodyText, { touches: [{ clientX: 120, clientY: 160 }] });
    fireEvent.touchEnd(bodyText, { changedTouches: [{ clientX: 120, clientY: 160 }] });
    expect(onClose).not.toHaveBeenCalled();

    // Strong downward pull from top to bottom inside the card closes the sheet
    fireEvent.touchStart(bodyText, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchMove(bodyText, { touches: [{ clientX: 122, clientY: 220 }] });
    fireEvent.touchEnd(bodyText, { changedTouches: [{ clientX: 122, clientY: 220 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on strong downward wheel overscroll at the top of the card", () => {
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    const sheetState: SheetState = {
      tileId: "wheel-tile",
      title: "Wheel Test",
      anchorEl: anchor,
      content: <div>Wheel Card Content</div>,
    };

    render(<DetailSheet sheet={sheetState} onClose={onClose} />);
    const bodyText = screen.getByText("Wheel Card Content");

    // Scrolling down into the card (positive deltaY) does not close
    fireEvent.wheel(bodyText, { deltaY: 120 });
    expect(onClose).not.toHaveBeenCalled();

    // Strong overscroll pull at the top of the card (negative deltaY) closes
    fireEvent.wheel(bodyText, { deltaY: -120 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens WidgetTile detail inside DetailSheetProvider without infinite layout update loops", async () => {
    render(
      <DetailSheetProvider>
        <WidgetTile title="UV Index" detail={<div>UV Detail Content</div>}>
          <span>6 High</span>
        </WidgetTile>
      </DetailSheetProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /UV Index/i }));
    expect(await screen.findByText("UV Detail Content")).toBeInTheDocument();
  });
});
