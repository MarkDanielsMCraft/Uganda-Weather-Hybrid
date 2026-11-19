"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlaceLocation } from "@/lib/places/types";

interface PreferencesState {
  districtSlug: string;
  activePlace: PlaceLocation | null;
  /** Explicit UI language preference: "en" for English, "lg" for Luganda. */
  uiLanguage: "en" | "lg";
  /** Explicit choice from the settings toggle. Null means "not chosen", in
      which case the device decides (see `useLiteScene`). A new key rather
      than the old `liteMode` boolean, because that one persisted `false` for
      everybody whether or not they had ever opened settings, so it could not
      tell an actual preference apart from a default. */
  liteModePreference: boolean | null;
  pushAlerts: boolean;
  pushDeviceToken: string | null;
  recentDistricts: string[];
  recentPlaces: PlaceLocation[];
  /** Null until the cookie banner has been answered. Google Analytics
      (a cookie-based tracker) only loads once this is explicitly true;
      Vercel Analytics/Speed Insights are cookieless and load regardless,
      so they are not gated by this flag. See ADR-006. */
  analyticsConsent: boolean | null;
  _hasHydrated: boolean;
  setDistrictSlug: (slug: string) => void;
  setActivePlace: (place: PlaceLocation | null) => void;
  setUiLanguage: (uiLanguage: "en" | "lg") => void;
  selectDistrict: (slug: string) => void;
  selectPlace: (place: PlaceLocation) => void;
  setLiteModePreference: (liteModePreference: boolean | null) => void;
  setPushAlerts: (pushAlerts: boolean) => void;
  setPushDeviceToken: (token: string | null) => void;
  setAnalyticsConsent: (analyticsConsent: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  clearRecents: () => void;
}

function pushRecent(recent: string[], slug: string) {
  return [slug, ...recent.filter((item) => item !== slug)].slice(0, 8);
}

function pushRecentPlace(recent: PlaceLocation[], place: PlaceLocation) {
  return [place, ...recent.filter((item) => item.key !== place.key)].slice(0, 8);
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      districtSlug: "kampala",
      activePlace: null,
      uiLanguage: "en",
      liteModePreference: null,
      pushAlerts: false,
      pushDeviceToken: null,
      recentDistricts: [],
      recentPlaces: [],
      analyticsConsent: null,
      _hasHydrated: false,
      setDistrictSlug: (districtSlug) => set({ districtSlug }),
      setActivePlace: (activePlace) => set({ activePlace }),
      setUiLanguage: (uiLanguage) => set({ uiLanguage }),
      selectDistrict: (districtSlug) =>
        set((state) => ({
          districtSlug,
          activePlace: null,
          recentDistricts: pushRecent(state.recentDistricts, districtSlug),
        })),
      selectPlace: (place) =>
        set((state) => ({
          districtSlug: place.parentDistrictSlug,
          activePlace: place,
          recentPlaces: pushRecentPlace(state.recentPlaces, place),
        })),
      setLiteModePreference: (liteModePreference) => set({ liteModePreference }),
      setPushAlerts: (pushAlerts) => set({ pushAlerts }),
      setPushDeviceToken: (pushDeviceToken) => set({ pushDeviceToken }),
      setAnalyticsConsent: (analyticsConsent) => set({ analyticsConsent }),
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
      clearRecents: () => set({ recentDistricts: [], recentPlaces: [] }),
    }),
    {
      name: "uw:preferences",
      skipHydration: true,
      partialize: (state) => ({
        districtSlug: state.districtSlug,
        activePlace: state.activePlace,
        uiLanguage: state.uiLanguage,
        liteModePreference: state.liteModePreference,
        pushAlerts: state.pushAlerts,
        pushDeviceToken: state.pushDeviceToken,
        recentDistricts: state.recentDistricts,
        recentPlaces: state.recentPlaces,
        analyticsConsent: state.analyticsConsent,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
