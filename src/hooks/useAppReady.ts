"use client";

import { usePreferencesStore } from "@/stores/preferencesStore";

export function useAppReady() {
  return usePreferencesStore((state) => state._hasHydrated);
}
