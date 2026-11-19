"use client";

import { useEffect, useState, type RefObject } from "react";

/** Measures the real, rendered DOM layout to compute how many grid
    columns an item should span to reach the right edge of its row —
    hand-computing this from tile counts turned out to be unreliable,
    since CSS Grid's `dense` auto-placement can leave an odd number of
    medium (col-span-2) tiles before the small-tile section, which
    breaks the "small tiles always start on a fresh row" assumption a
    hand-written formula depends on. Actual layout is the only source of
    truth dense-packing itself uses, so this reads it back directly:
    render the item at span 1, measure where dense-packing actually put
    it, then compute how many more columns fit before the container's
    right edge.

    `deps` should include anything that changes tile counts (weather
    bundle identity, alert count, etc.) so this re-measures instead of
    trusting a stale layout from before a re-render. */
export function useFillRemainingColumns(
  containerRef: RefObject<HTMLElement | null>,
  itemRef: RefObject<HTMLElement | null>,
  columns: number,
  deps: unknown[],
) {
  const [span, setSpan] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const item = itemRef.current;
    if (!container || !item) return;

    let rafId = 0;
    function recompute() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!container || !item) return;
        const previousSpan = item.style.gridColumn;
        item.style.gridColumn = "span 1";
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        item.style.gridColumn = previousSpan;

        const styles = getComputedStyle(container);
        const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
        const columnWidth = (containerRect.width - gap * (columns - 1)) / columns;
        if (!Number.isFinite(columnWidth) || columnWidth <= 0) return;

        const availableWidth = containerRect.right - itemRect.left;
        const fittingColumns = Math.max(
          1,
          Math.min(columns, Math.round((availableWidth + gap) / (columnWidth + gap))),
        );
        setSpan(fittingColumns);
      });
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, itemRef, columns, ...deps]);

  return span;
}
