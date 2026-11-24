"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlaceLocation } from "@/lib/places/types";
import { trustedPlace, trustedPlaceOrNull } from "@/lib/places/trusted-place";

interface PreferencesState {
  districtSlug: string;
  activePlace: PlaceLocation | null;
  /** Explicit UI language preference: "en" for English, "lg" for Luganda. */
  uiLanguage: "en" | "lg";
  /** True once the user explicitly picks a language in the UI, so automatic
      device-language detection never overrides a deliberate user choice. */
  hasExplicitLanguageChoice: boolean;
  /** Explicit choice from the settings toggle. Null means "not chosen", in
      which case the device decides (see `useLiteScene`). A new key rather
      than the old `liteMode` boolean, because that one persisted `false` for
      everybody whether or not they had ever opened settings, so it could not
      tell an actual preference apart from a default. */
  liteModePreference: boolean | null;
  /** Persistent hands-free voice companion mode: when a user selects any voice
      button, the app assumes they prefer spoken audio (e.g. non-readers,
      grandmothers, or blind users) and reads open sheets and advisor replies
      aloud automatically. */
  voiceMode: boolean;
  /** Accessibility display preference: scales typography for elderly and
      low-vision users without altering layout or brand colours. */
  largeText: boolean;
  /** Accessibility display preference: increases text and glass border
      contrast for low-vision users and bright outdoor sunlight. */
  highContrast: boolean;
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
  applyDetectedLanguage: (uiLanguage: "en" | "lg") => void;
  selectDistrict: (slug: string) => void;
  selectPlace: (place: PlaceLocation) => void;
  setLiteModePreference: (liteModePreference: boolean | null) => void;
  setVoiceMode: (voiceMode: boolean) => void;
  setLargeText: (largeText: boolean) => void;
  setHighContrast: (highContrast: boolean) => void;
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
      hasExplicitLanguageChoice: false,
      liteModePreference: null,
      voiceMode: false,
      largeText: false,
      highContrast: false,
      pushAlerts: false,
      pushDeviceToken: null,
      recentDistricts: [],
      recentPlaces: [],
      analyticsConsent: null,
      _hasHydrated: false,
      setDistrictSlug: (districtSlug) => set({ districtSlug }),
      setActivePlace: (activePlace) => set({ activePlace: activePlace ? trustedPlace(activePlace) : null }),
      setUiLanguage: (uiLanguage) => set({ uiLanguage, hasExplicitLanguageChoice: true }),
      applyDetectedLanguage: (uiLanguage) => set({ uiLanguage }),
      selectDistrict: (districtSlug) =>
        set((state) => ({
          districtSlug,
          activePlace: null,
          recentDistricts: pushRecent(state.recentDistricts, districtSlug),
        })),
      selectPlace: (rawPlace) =>
        set((state) => {
          const place = trustedPlace(rawPlace);
          return {
            districtSlug: place.parentDistrictSlug,
            activePlace: place,
            recentPlaces: pushRecentPlace(state.recentPlaces, place),
          };
        }),
      setLiteModePreference: (liteModePreference) => set({ liteModePreference }),
      setVoiceMode: (voiceMode) => set({ voiceMode }),
      setLargeText: (largeText) => set({ largeText }),
      setHighContrast: (highContrast) => set({ highContrast }),
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
        hasExplicitLanguageChoice: state.hasExplicitLanguageChoice,
        liteModePreference: state.liteModePreference,
        voiceMode: state.voiceMode,
        largeText: state.largeText,
        highContrast: state.highContrast,
        pushAlerts: state.pushAlerts,
        pushDeviceToken: state.pushDeviceToken,
        recentDistricts: state.recentDistricts,
        recentPlaces: state.recentPlaces,
        analyticsConsent: state.analyticsConsent,
      }),
      // Saved settings can be edited by anyone with the phone or by a script
      // on an old version, so saved places are checked again on load.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PreferencesState>;
        return {
          ...current,
          ...saved,
          activePlace: trustedPlaceOrNull(saved.activePlace),
          recentPlaces: Array.isArray(saved.recentPlaces)
            ? saved.recentPlaces.flatMap((place) => trustedPlaceOrNull(place) ?? [])
            : current.recentPlaces,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
