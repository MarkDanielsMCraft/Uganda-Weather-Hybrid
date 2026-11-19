"use client";

import { useRef, useState, type ReactNode, type TouchEvent, type UIEvent } from "react";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { useTranslation } from "@/lib/i18n";

const PULL_THRESHOLD = 72;
const ACTIVATION_THRESHOLD = 10;

export function PullToRefresh({
  children,
  className = "",
  onScroll,
}: {
  children: ReactNode;
  className?: string;
  onScroll?: (event: UIEvent<HTMLElement>) => void;
}) {
  const { dict } = useTranslation();
  const { refresh, isRefreshing } = useRefreshWeather();
  const scrollRef = useRef<HTMLElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const isDraggingDown = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const element = scrollRef.current;
    if (!element || element.scrollTop > 0 || isRefreshing) return;
    tracking.current = true;
    isDraggingDown.current = false;
    startX.current = event.touches[0]?.clientX ?? 0;
    startY.current = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!tracking.current || isRefreshing) return;
    const element = scrollRef.current;
    if (!element || element.scrollTop > 0) {
      tracking.current = false;
      isDraggingDown.current = false;
      setPullDistance(0);
      return;
    }

    const currentX = event.touches[0]?.clientX ?? startX.current;
    const currentY = event.touches[0]?.clientY ?? startY.current;
    const deltaX = Math.abs(currentX - startX.current);
    const deltaY = currentY - startY.current;

    // If horizontal motion exceeds vertical, this is a horizontal card swipe rather than a pull down
    if (!isDraggingDown.current && deltaX > Math.abs(deltaY)) {
      tracking.current = false;
      return;
    }

    if (deltaY > ACTIVATION_THRESHOLD) {
      isDraggingDown.current = true;
      setPullDistance(Math.min(deltaY - ACTIVATION_THRESHOLD, 120));
    }
  };

  const onTouchEnd = async () => {
    if (!tracking.current) return;
    tracking.current = false;
    isDraggingDown.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setPullDistance(PULL_THRESHOLD);
      await refresh();
    }

    setPullDistance(0);
  };

  const showIndicator = pullDistance > 0 || isRefreshing;
  const progress = isRefreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <main
      ref={scrollRef}
      className={className}
      onScroll={onScroll}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => {
        void onTouchEnd();
      }}
    >
      {showIndicator && (
        <div
          className={`flex items-center justify-center overflow-hidden lg:hidden ${
            tracking.current ? "" : "transition-[height] duration-200"
          }`}
          style={{ height: isRefreshing ? 44 : pullDistance * 0.55 }}
          aria-hidden={!showIndicator}
        >
          <div
            className={`rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] text-white/70 ${
              isRefreshing ? "animate-pulse" : ""
            }`}
            style={{ opacity: 0.35 + progress * 0.65 }}
          >
            {isRefreshing
              ? dict.common.updating
              : progress >= 1
                ? dict.common.releaseToRefresh
                : dict.common.pullToRefresh}
          </div>
        </div>
      )}
      {children}
    </main>
  );
}
