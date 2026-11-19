"use client";

import { useEffect } from "react";
import { getDistrictBySlug } from "@/lib/districts";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Rehydrate persisted preferences once at app startup. */
export function PreferencesBootstrap() {
  useEffect(() => {
    const result = usePreferencesStore.persist.rehydrate();
    const markReady = () => {
      const store = usePreferencesStore.getState();
      // Drop a persisted place that points outside Uganda (e.g. saved from a
      // GPS fix taken abroad) so the app falls back to its district instead of
      // reloading straight into a location every forecast lookup rejects.
      if (store.activePlace && !isWithinUganda(store.activePlace.lat, store.activePlace.lon)) {
        store.setActivePlace(null);
      }
      if (typeof window !== "undefined" && window.location.search) {
        const params = new URLSearchParams(window.location.search);
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
      return;
    }

    markReady();
  }, []);

  return null;
}
