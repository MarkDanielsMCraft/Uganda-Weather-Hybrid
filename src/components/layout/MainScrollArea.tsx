"use client";

import { useRef, useState, type ReactNode, type UIEvent } from "react";
import { AppFooter } from "@/components/layout/AppFooter";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";
import { LocationConsentCard } from "@/components/layout/LocationConsentCard";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { LugandaBetaBanner } from "@/components/feedback/LugandaBetaBanner";
import {
  ScrollCollapseProvider,
  type ScrollCollapseState,
} from "@/components/layout/ScrollCollapseContext";

export function MainScrollArea({ children }: { children: ReactNode }) {
  const [collapseState, setCollapseState] = useState<ScrollCollapseState>({
    progress: 0,
    isCollapsed: false,
  });
  const rafId = useRef<number | null>(null);

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const top = event.currentTarget.scrollTop;
    if (rafId.current != null) cancelAnimationFrame(rafId.current);

    rafId.current = requestAnimationFrame(() => {
      // Progress from 0 at <= 40px to 1 at >= 140px
      const rawProgress = Math.min(1, Math.max(0, (top - 40) / 100));
      const progress = Number(rawProgress.toFixed(2));
      const isCollapsed = top >= 75;

      setCollapseState((prev) => {
        if (prev.progress === progress && prev.isCollapsed === isCollapsed) {
          return prev;
        }
        return { progress, isCollapsed };
      });
    });
  };

  return (
    <ScrollCollapseProvider value={collapseState}>
      <PullToRefresh
        className="main-scroll flex w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-0 lg:pt-0"
        onScroll={handleScroll}
      >
        {/* Footer sits outside this constrained column (below) so it can
            span the full width of the content area instead of trailing off
            as a narrow centered strip on large screens. */}
        <div className="mx-auto flex w-full min-w-0 max-w-none flex-1 flex-col px-4 md:max-w-2xl md:px-6 lg:max-w-6xl lg:px-8 xl:max-w-[1360px]">
          {/* Brand mark on every page, not just home/district */}
          <MobileHeader />
          <MobileTopBar />
          <OfflineIndicator />
          <LugandaBetaBanner />
          <PwaInstallBanner />
          {children}
        </div>
        <AppFooter />
        <CookieConsentBanner />
        <LocationConsentCard />
      </PullToRefresh>
    </ScrollCollapseProvider>
  );
}
