"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(query: string) {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

/** True at Tailwind `lg` and above (1024px+) */
export function useIsLgUp() {
  return useSyncExternalStore(
    (callback) => subscribe("(min-width: 1024px)", callback),
    () => getSnapshot("(min-width: 1024px)"),
    getServerSnapshot,
  );
}
