"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import type { SheetState } from "@/components/sheet/DetailSheetProvider";
import { computeSheetLayout, type DetailSheetLayout } from "@/components/sheet/detailSheetLayout";
import { DetailSheetPointer } from "@/components/sheet/DetailSheetPointer";
import { DetailSheetGrabber } from "@/components/sheet/DetailSheetGrabber";
import { WeatherListenButton } from "@/components/settings/WeatherListenButton";
import { useTranslation } from "@/lib/i18n";

// Genuinely translucent: real colour and light from the page behind
// should read through clearly, not just a faint hint at the edges. Since
// the page behind the sheet is deliberately never dimmed (everything
// outside the sheet stays 100% visible), legibility at this opacity comes
// from the text shadow below, not from the panel being dark enough to act
// as its own contrast floor.
const GLASS_BACKGROUND =
  "linear-gradient(155deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 55%), rgba(18,20,34,0.42)";
const GLASS_BACKDROP_FILTER = "blur(38px) saturate(165%)";
// A soft dark shadow under the text itself is the technique that keeps
// text legible on true glass, not a darker panel behind it. Set once here
// and inherited by every descendant instead of repeated per element.
const GLASS_TEXT_SHADOW = "0 1px 3px rgba(0,0,0,0.55)";

interface TouchPullState {
  startY: number;
  startX: number;
  lastY: number;
  lastX: number;
  startTime: number;
  startScrollTop: number;
  reachedTopAtY: number | null;
  ignored: boolean;
}

function isSameSheetLayout(a: DetailSheetLayout | null, b: DetailSheetLayout | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.side === b.side &&
    a.pointerOffset === b.pointerOffset
  );
}

/** The single shared detail sheet, anchored to whichever tile opened it.
    Desktop places it beside the tile (whichever side has more room),
    vertically centred on the tile, with a pointer triangle touching the
    tile's vertical centre. Mobile uses a bottom sheet with the pointer on
    its top edge, horizontally aligned under the tapped tile — the same
    pattern, not a different one, per the requirement that this design
    works on mobile too. Switching to a different tile while the sheet is
    already open updates position in place so the pointer animates to the
    new tile instead of the sheet closing and reopening. */
export function DetailSheet({ sheet, onClose }: { sheet: SheetState | null; onClose: () => void }) {
  const { dict } = useTranslation();
  const isDesktop = useIsLgUp();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<DetailSheetLayout | null>(null);
  const dragControls = useDragControls();
  // Which way the sheet leaves, so a card flicked upward exits upward
  // instead of snapping back down past the finger that just threw it.
  const [exitUp, setExitUp] = useState(false);
  const [pullOffsetY, setPullOffsetY] = useState(0);
  const touchPullRef = useRef<TouchPullState | null>(null);
  const wheelOverscrollRef = useRef<{ accum: number; lastTs: number }>({ accum: 0, lastTs: 0 });

  const sheetTileId = sheet?.tileId ?? null;
  const sheetAnchorEl = sheet?.anchorEl ?? null;
  const isSheetOpen = Boolean(sheet);

  useEffect(() => {
    if (!isSheetOpen) return;
    setExitUp(false);
    setPullOffsetY(0);
  }, [isSheetOpen, sheetTileId]);

  function handleDragEnd(_event: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    // Either a decisive distance or a decisive flick. Velocity matters as
    // much as distance: a short fast swipe is a dismissal, a long slow drag
    // is someone changing their mind, and only counting pixels gets both
    // wrong.
    const flung = Math.abs(info.velocity.y) > 550;
    const far = Math.abs(info.offset.y) > 110;
    if (!flung && !far) return;

    const goingUp = (flung ? info.velocity.y : info.offset.y) < 0;
    setExitUp(goingUp);
    onClose();
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    const target = event.target as HTMLElement | null;
    const ignored = Boolean(target?.closest(".leaflet-container, input[type='range'], [data-no-sheet-drag]"));
    const scrollTop = sheetRef.current?.scrollTop ?? 0;

    touchPullRef.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      lastY: touch.clientY,
      lastX: touch.clientX,
      startTime: performance.now(),
      startScrollTop: scrollTop,
      reachedTopAtY: scrollTop <= 2 ? touch.clientY : null,
      ignored,
    };
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const state = touchPullRef.current;
    const touch = event.touches[0];
    if (!state || state.ignored || !touch) return;

    state.lastY = touch.clientY;
    state.lastX = touch.clientX;
    const scrollTop = sheetRef.current?.scrollTop ?? 0;

    if (scrollTop <= 2 && state.reachedTopAtY === null) {
      state.reachedTopAtY = touch.clientY;
    } else if (scrollTop > 4) {
      state.reachedTopAtY = null;
      if (pullOffsetY !== 0) setPullOffsetY(0);
      return;
    }

    const pullDownY = state.reachedTopAtY !== null ? touch.clientY - state.reachedTopAtY : 0;
    const deltaX = Math.abs(touch.clientX - state.startX);

    if (scrollTop <= 2 && pullDownY > 6 && pullDownY > deltaX * 1.2) {
      setPullOffsetY(Math.min(180, Math.round(pullDownY * 0.55)));
    } else if (pullOffsetY !== 0) {
      setPullOffsetY(0);
    }
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const state = touchPullRef.current;
    touchPullRef.current = null;
    if (!state || state.ignored) {
      if (pullOffsetY !== 0) setPullOffsetY(0);
      return;
    }

    const changed = event.changedTouches[0];
    const endY = changed ? changed.clientY : state.lastY;
    const endX = changed ? changed.clientX : state.lastX;
    const totalDeltaY = endY - state.startY;
    const totalDeltaX = Math.abs(endX - state.startX);
    const elapsedMs = Math.max(1, performance.now() - state.startTime);
    const velocityY = (totalDeltaY / elapsedMs) * 1000;
    const scrollTop = sheetRef.current?.scrollTop ?? 0;
    const pullDownAfterTop = state.reachedTopAtY !== null ? endY - state.reachedTopAtY : 0;

    if (pullOffsetY !== 0) {
      setPullOffsetY(0);
    }

    if (totalDeltaY <= 0 || totalDeltaY <= totalDeltaX * 1.2 || scrollTop > 4) {
      return;
    }

    const dismissedFromTop =
      state.startScrollTop <= 4 &&
      (pullDownAfterTop >= 75 || (pullDownAfterTop >= 35 && velocityY >= 500));
    const dismissedByForcefulPull =
      pullDownAfterTop >= 85 || (totalDeltaY >= 120 && velocityY >= 650);

    if (dismissedFromTop || dismissedByForcefulPull) {
      setExitUp(false);
      onClose();
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (isDesktop) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".leaflet-container")) return;

    const scrollTop = sheetRef.current?.scrollTop ?? 0;
    if (scrollTop > 2 || event.deltaY >= 0) {
      wheelOverscrollRef.current.accum = 0;
      return;
    }

    const now = performance.now();
    if (now - wheelOverscrollRef.current.lastTs > 260) {
      wheelOverscrollRef.current.accum = 0;
    }
    wheelOverscrollRef.current.lastTs = now;
    wheelOverscrollRef.current.accum += Math.abs(event.deltaY);

    if (Math.abs(event.deltaY) >= 95 || wheelOverscrollRef.current.accum >= 160) {
      wheelOverscrollRef.current.accum = 0;
      setExitUp(false);
      onClose();
    }
  }

  useEffect(() => {
    if (!isSheetOpen) return;
    const scrollContainer = document.querySelector<HTMLElement>(".main-scroll");
    const prevScrollOverflow = scrollContainer?.style.overflow;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (scrollContainer) {
      scrollContainer.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      if (scrollContainer && prevScrollOverflow !== undefined) {
        scrollContainer.style.overflow = prevScrollOverflow;
      }
    };
  }, [isSheetOpen]);

  useLayoutEffect(() => {
    if (!isSheetOpen || !sheetAnchorEl) {
      setLayout((prev) => (prev === null ? prev : null));
      return;
    }
    const anchorEl = sheetAnchorEl;

    function recompute() {
      const next = computeSheetLayout(anchorEl, sheetRef.current, isDesktop);
      setLayout((prev) => (isSameSheetLayout(prev, next) ? prev : next));
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(anchorEl);
    if (sheetRef.current) observer.observe(sheetRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [isSheetOpen, sheetTileId, sheetAnchorEl, isDesktop]);

  useEffect(() => {
    if (!isSheetOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSheetOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {sheet && (
        <>
          {/* Click-to-close hit target only — deliberately no dimming or
              blur here. Everything outside the sheet (other tiles, the
              10-day list, the map) must stay exactly as visible as it was
              before the sheet opened; only the sheet's own panel darkens,
              not the page behind it. */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheet.title}
            className={isDesktop ? "fixed z-50" : "fixed inset-x-0 bottom-0 z-50"}
            style={{ width: isDesktop ? layout?.width : undefined }}
            initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1, left: layout?.left ?? 0, top: layout?.top ?? 0 } : { y: 0 }}
            exit={
              isDesktop
                ? { opacity: 0, scale: 0.96 }
                : { y: exitUp ? "-100%" : "100%", opacity: exitUp ? 0 : 1 }
            }
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            // Drag to dismiss, mobile only. Handled cleanly by the grabber
            // via dragControls so the card body can scroll smoothly without
            // touch-drag conflicts.
            {...(isDesktop
              ? {}
              : {
                  drag: "y" as const,
                  dragControls,
                  dragListener: false,
                  dragConstraints: { top: 0, bottom: 0 },
                  // Freer downward than upward: down is where the sheet
                  // already lives, so it should feel loose, while up is
                  // pulling against the screen edge and should feel taut.
                  dragElastic: { top: 0.35, bottom: 0.7 },
                  onDragEnd: handleDragEnd,
                })}
          >
            {/*
              The diamond sits behind the card in DOM order (rendered
              first, so the card paints over its inner half) and outside
              the card's own box on the outer half, which is what makes it
              stick out and point at the tile without being clipped by the
              card's own overflow-y-auto.
            */}
            {layout && (
              <DetailSheetPointer
                layout={layout}
                glassBackground={GLASS_BACKGROUND}
                glassBackdropFilter={GLASS_BACKDROP_FILTER}
              />
            )}

            <div
              ref={sheetRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onWheel={handleWheel}
              className={
                isDesktop
                  ? "relative max-h-[85vh] overflow-y-auto overscroll-contain rounded-[30px] border border-white/[0.18] p-6 text-[14px] font-medium leading-relaxed text-white/90 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)]"
                  : "relative max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-[30px] border-t border-white/[0.18] p-6 pt-3 text-[14px] font-medium leading-relaxed text-white/90 shadow-[0_-24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)]"
              }
              style={{
                // Translucent glass: genuinely translucent (real colour and
                // light from the page shows through), a diagonal
                // light-catching highlight like a real glass edge, and
                // enough blur+saturate to keep whatever's behind it calm
                // rather than distracting. Legibility comes from the text
                // shadow below, not from this panel being dark/opaque
                // enough to act as its own contrast floor — the page
                // behind the sheet is deliberately never dimmed.
                background: GLASS_BACKGROUND,
                backdropFilter: GLASS_BACKDROP_FILTER,
                WebkitBackdropFilter: GLASS_BACKDROP_FILTER,
                textShadow: GLASS_TEXT_SHADOW,
                paddingBottom: isDesktop ? undefined : "max(1.5rem, env(safe-area-inset-bottom))",
                transform: pullOffsetY > 0 ? `translate3d(0, ${pullOffsetY}px, 0)` : undefined,
                transition: pullOffsetY > 0 ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {!isDesktop && <DetailSheetGrabber dragControls={dragControls} />}

              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {sheet.icon && <span className="text-white/60">{sheet.icon}</span>}
                  <p className="text-[15px] font-semibold text-white/85">
                    {sheet.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <WeatherListenButton
                    compact
                    tileIdOverride={`${sheet.tileId} ${sheet.title}`}
                    autoNarrateOnSheetChange
                    testId="sheet-listen-toggle"
                  />
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={dict.common.close}
                    className="shrink-0 text-[15px] text-white/50 hover:text-white/80"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={sheet.tileId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {sheet.content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
