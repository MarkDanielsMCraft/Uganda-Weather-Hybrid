"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface ScrollCollapseState {
  /** Normalized scroll progress from 0 (at top) to 1 (past hero) */
  progress: number;
  /** True when the hero has scrolled past the collapse threshold */
  isCollapsed: boolean;
}

const ScrollCollapseContext = createContext<ScrollCollapseState>({
  progress: 0,
  isCollapsed: false,
});

export function ScrollCollapseProvider({
  value,
  children,
}: {
  value: ScrollCollapseState;
  children: ReactNode;
}) {
  return (
    <ScrollCollapseContext.Provider value={value}>
      {children}
    </ScrollCollapseContext.Provider>
  );
}

export function useScrollCollapse() {
  return useContext(ScrollCollapseContext);
}

