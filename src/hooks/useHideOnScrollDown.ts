"use client";

import { useCallback, useEffect, useState } from "react";

/** Distance in pixels the page must move before the floating button reacts,
    so small finger jitters do not make it flicker. */
const DEFAULT_THRESHOLD_PX = 16;
/** Near the very top or bottom of a page the button always shows, because
    the page has bottom padding there and the button covers nothing. */
const EDGE_PX = 24;

/** Tells a floating button to step aside while the user scrolls down to read,
    and come back when they scroll up or reach the top or bottom. Listens to
    scrolling anywhere on the page, including inner scroll areas such as the
    /lite page, which scrolls a container instead of the window. */
export function useHideOnScrollDown(
  enabled: boolean,
  threshold = DEFAULT_THRESHOLD_PX,
): { hidden: boolean; reveal: () => void } {
  const [hidden, setHidden] = useState(false);
  const reveal = useCallback(() => setHidden(false), []);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const anchors = new WeakMap<Element, number>();

    const onScroll = (event: Event) => {
      const target =
        event.target === document ? document.scrollingElement : (event.target as Element | null);
      if (!target || !(target instanceof Element)) return;

      const top = target.scrollTop;
      const distanceToBottom = target.scrollHeight - target.clientHeight - top;
      if (top <= EDGE_PX || distanceToBottom <= EDGE_PX) {
        anchors.set(target, top);
        setHidden(false);
        return;
      }

      const anchor = anchors.get(target) ?? top;
      if (top - anchor > threshold) {
        anchors.set(target, top);
        setHidden(true);
      } else if (anchor - top > threshold) {
        anchors.set(target, top);
        setHidden(false);
      } else if (!anchors.has(target)) {
        anchors.set(target, top);
      }
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled, threshold]);

  return { hidden, reveal };
}
