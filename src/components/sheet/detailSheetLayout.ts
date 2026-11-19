export const MARGIN = 16;
export const POINTER_REACH = 28;
export const POINTER_BASE = 18;
// The pointer is a rotated square (a diamond), not an SVG triangle — the
// same background/blur/border as the sheet card itself, positioned with
// its centre ON the card's edge and the card painted after it in DOM
// order (so the card's own opaque paint naturally covers the diamond's
// inner half). This is the standard technique for a callout arrow that
// reads as literally the same piece of glass as the body it points from,
// rather than a separate shape trying to approximate the same colour —
// approximating a CSS gradient inside a flat SVG fill never quite
// matches, since the sheet's backdrop-filter samples different pixels
// than whatever the SVG happens to be drawn over.
export const DIAMOND_SIZE = 24;

export type Side = "left" | "right" | "top";

export interface DetailSheetLayout {
  left: number;
  top: number;
  width?: number;
  side: Side;
  pointerOffset: number;
}

export function computeSheetLayout(
  anchorEl: HTMLElement,
  sheetEl: HTMLElement | null,
  isDesktop: boolean,
): DetailSheetLayout {
  const anchorRect = anchorEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!isDesktop) {
    return {
      left: 0,
      top: 0,
      side: "top",
      pointerOffset: Math.min(
        Math.max(anchorRect.left + anchorRect.width / 2, MARGIN + POINTER_BASE / 2),
        viewportWidth - MARGIN - POINTER_BASE / 2,
      ),
    };
  }

  const sheetHeight = sheetEl?.offsetHeight ?? 0;
  const width = Math.min(380, viewportWidth - MARGIN * 2);
  const spaceRight = viewportWidth - anchorRect.right;
  const spaceLeft = anchorRect.left;
  const side: Side =
    spaceRight >= width + POINTER_REACH + MARGIN || spaceRight >= spaceLeft ? "right" : "left";

  let left = side === "right" ? anchorRect.right + POINTER_REACH : anchorRect.left - POINTER_REACH - width;
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, viewportWidth - width - MARGIN));

  const idealTop = anchorRect.top + anchorRect.height / 2 - sheetHeight / 2;
  const top = Math.min(Math.max(idealTop, MARGIN), Math.max(MARGIN, viewportHeight - sheetHeight - MARGIN));

  const anchorCenter = anchorRect.top + anchorRect.height / 2;
  const pointerOffset = Math.min(
    Math.max(anchorCenter - top, MARGIN + POINTER_BASE / 2),
    Math.max(MARGIN + POINTER_BASE / 2, sheetHeight - MARGIN - POINTER_BASE / 2),
  );

  return { left, top, width, side, pointerOffset };
}
