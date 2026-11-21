"use client";

import { useEffect } from "react";
import { getDistrictBySlug } from "@/lib/districts";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { usePreferencesStore } from "@/stores/preferencesStore";

export function detectDeviceUiLanguage(): "en" | "lg" {
  if (typeof navigator === "undefined") return "en";
  const candidates =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  for (const tag of candidates) {
    const lower = tag.trim().toLowerCase();
    if (lower === "lg" || lower.startsWith("lg-") || lower.startsWith("lug")) {
      return "lg";
    }
    if (lower === "en" || lower.startsWith("en-")) {
      return "en";
    }
  }
  return "en";
}

/** Rehydrate persisted preferences once at app startup. */
export function PreferencesBootstrap() {
  const largeText = usePreferencesStore((state) => state.largeText);
  const highContrast = usePreferencesStore((state) => state.highContrast);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (largeText) {
      root.dataset.a11yText = "large";
    } else {
      delete root.dataset.a11yText;
    }
    if (highContrast) {
      root.dataset.a11yContrast = "high";
    } else {
      delete root.dataset.a11yContrast;
    }
  }, [largeText, highContrast]);

  useEffect(() => {
    const syncDeviceLanguage = () => {
      const store = usePreferencesStore.getState();
      if (store.hasExplicitLanguageChoice) return;
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/lg")) {
        return;
      }
      const detected = detectDeviceUiLanguage();
      if (detected !== store.uiLanguage) {
        store.applyDetectedLanguage(detected);
      }
    };

    const result = usePreferencesStore.persist.rehydrate();
    const markReady = () => {
      const store = usePreferencesStore.getState();
      // Drop a persisted place that points outside Uganda (e.g. saved from a
      // GPS fix taken abroad) so the app falls back to its district instead of
      // reloading straight into a location every forecast lookup rejects.
      if (store.activePlace && !isWithinUganda(store.activePlace.lat, store.activePlace.lon)) {
        store.setActivePlace(null);
      }
      syncDeviceLanguage();
      if (typeof window !== "undefined" && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        let urlMutated = false;
        const langParam = params.get("lang")?.trim().toLowerCase();
        if (langParam === "en" || langParam === "lg") {
          store.setUiLanguage(langParam);
          params.delete("lang");
          urlMutated = true;
        }
        if (params.get("mode") === "full") {
          store.setLiteModePreference(false);
          params.delete("mode");
          urlMutated = true;
        }
        if (urlMutated) {
          const cleanQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
          try {
            window.history.replaceState(null, "", cleanUrl);
          } catch {
            // Ignore history restrictions
          }
        }
        const placeKey = params.get("place")?.trim();
        const placeName = params.get("name")?.trim();
        const lat = Number(params.get("lat"));
        const lon = Number(params.get("lon"));
        const parent = params.get("parent")?.trim().toLowerCase() || store.districtSlug;
        if (
          placeKey &&
          placeName &&
          Number.isFinite(lat) &&
          Number.isFinite(lon) &&
          isWithinUganda(lat, lon)
        ) {
          const parentDistrict = getDistrictBySlug(parent);
          store.selectPlace({
            key: placeKey,
            name: placeName,
            label: params.get("label")?.trim() || placeName,
            lat,
            lon,
            parentDistrictSlug: parentDistrict?.slug ?? parent,
            region: parentDistrict?.region ?? "central",
          });
        }
      }
      store.setHasHydrated(true);
    };

    if (result instanceof Promise) {
      void result.finally(markReady);
    } else {
      markReady();
    }

    if (typeof window === "undefined") return;
    window.addEventListener("languagechange", syncDeviceLanguage);
    return () => {
      window.removeEventListener("languagechange", syncDeviceLanguage);
    };
  }, []);

  return null;
}
