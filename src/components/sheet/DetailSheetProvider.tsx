"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { primeVoicePlaybackForGesture } from "@/lib/ai/advisor-voice";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Loaded on first open, not on first paint. The sheet is the only thing on
    the home screen that pulls in framer-motion (~47 kB over the wire, ~144 kB
    parsed), and this provider sits in the root layout, so a static import put
    an animation library on the critical path of every page to power a panel
    that stays invisible until someone taps a tile. It renders through a
    portal and returns null when `document` is undefined, so there is no
    server-rendered output to lose by deferring it. */
const DetailSheet = dynamic(
  () => import("@/components/sheet/DetailSheet").then((m) => m.DetailSheet),
  { ssr: false },
);

export interface SheetState {
  tileId: string;
  title: string;
  icon?: ReactNode;
  anchorEl: HTMLElement | null;
  content: ReactNode;
}

export interface OpenSheetOptions {
  tileId: string;
  title: string;
  icon?: ReactNode;
  anchorEl: HTMLElement | null;
  content: ReactNode;
}

interface DetailSheetContextValue {
  sheet: SheetState | null;
  openSheet: (options: OpenSheetOptions) => void;
  closeSheet: () => void;
}

const DetailSheetContext = createContext<DetailSheetContextValue | null>(null);

/** Mounted once at the app root. Renders exactly one DetailSheet instance —
    opening a new tile while one is already open updates state in place
    rather than unmounting and remounting, which is what lets the pointer
    animate to the newly clicked tile instead of the sheet closing and
    reopening. Every tile (WidgetTile, alerts, map, agriculture, lake)
    shares this single sheet instead of each owning its own modal. */
export function DetailSheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Latched rather than derived from `sheet`, because AnimatePresence needs
  // the sheet still mounted while it animates out. Unmounting the moment
  // `sheet` goes null would cut the close animation off.
  const [hasOpened, setHasOpened] = useState(false);

  // Fetch the sheet's chunk once the browser is idle, so deferring it costs
  // nothing at the moment someone actually taps a tile. Without this the
  // first tap waits on a network round trip; with it the code is normally
  // already there, and it still never competes with first paint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const warm = () => {
      void import("@/components/sheet/DetailSheet");
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const openSheet = useCallback((options: OpenSheetOptions) => {
    if (usePreferencesStore.getState().voiceMode) {
      primeVoicePlaybackForGesture();
    }
    setHasOpened(true);
    setSheet((prev) => {
      if (
        prev &&
        prev.tileId === options.tileId &&
        prev.title === options.title &&
        prev.icon === options.icon &&
        prev.anchorEl === options.anchorEl &&
        prev.content === options.content
      ) {
        return prev;
      }
      return options;
    });
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  const activeTileId = sheet?.tileId ?? null;
  const contextSheet = useMemo(
    () => (sheet ? { ...sheet } : null),
    // Consumers of `useDetailSheet` only inspect `sheet?.tileId`; `DetailSheet`
    // receives the live `sheet` state directly via props below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTileId],
  );

  const value = useMemo(
    () => ({ sheet: contextSheet, openSheet, closeSheet }),
    [contextSheet, openSheet, closeSheet],
  );

  return (
    <DetailSheetContext.Provider value={value}>
      {children}
      {hasOpened ? <DetailSheet sheet={sheet} onClose={closeSheet} /> : null}
    </DetailSheetContext.Provider>
  );
}

export function useDetailSheet() {
  const ctx = useContext(DetailSheetContext);
  if (!ctx) {
    throw new Error("useDetailSheet must be used within a DetailSheetProvider");
  }
  return ctx;
}

export function useOptionalDetailSheet() {
  return useContext(DetailSheetContext);
}
