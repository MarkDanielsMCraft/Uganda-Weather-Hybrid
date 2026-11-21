"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getDistrictBySlug } from "@/lib/districts";
import { createPlaceLocation } from "@/lib/places/district-from-place";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { districtHomeHref } from "@/lib/places/share";
import { useAppReady } from "@/hooks/useAppReady";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Sync `?district=`, `?place=`, `?mode=full`, and `?lang=en|lg` URL params into persisted preferences on every client route transition. */
export function DistrictQuerySync() {
  const ready = useAppReady();
  const searchParams = useSearchParams();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);
  const selectPlace = usePreferencesStore((state) => state.selectPlace);
  const setUiLanguage = usePreferencesStore((state) => state.setUiLanguage);
  const setLiteModePreference = usePreferencesStore((state) => state.setLiteModePreference);

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/lite")) {
      return;
    }

    const rawLang = searchParams.get("lang")?.trim().toLowerCase();
    const rawMode = searchParams.get("mode")?.trim().toLowerCase();
    if (rawLang === "en" || rawLang === "lg" || rawMode === "full") {
      if (rawLang === "en" || rawLang === "lg") {
        setUiLanguage(rawLang);
      }
      if (rawMode === "full") {
        setLiteModePreference(false);
      }
      if (typeof window !== "undefined") {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete("lang");
        nextParams.delete("mode");
        const cleanQuery = nextParams.toString();
        const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
        try {
          window.history.replaceState(null, "", cleanUrl);
        } catch {
          // Ignore history restrictions
        }
      }
    }

    const placeKey = searchParams.get("place")?.trim();
    const placeName = searchParams.get("name")?.trim();
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (placeKey && placeName && Number.isFinite(lat) && Number.isFinite(lon)) {
      // Ignore a place param that points outside Uganda (e.g. a stale link
      // from a GPS fix taken abroad); selecting it would leave every forecast
      // lookup failing. Strip the params so the URL heals to a servable state.
      if (!isWithinUganda(lat, lon)) {
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
        return;
      }

      selectPlace(
        createPlaceLocation({
          key: placeKey,
          name: placeName,
          lat,
          lon,
          label: searchParams.get("label")?.trim() || undefined,
          parentDistrictSlug: searchParams.get("parent")?.trim().toLowerCase() || undefined,
        }),
      );
      return;
    }

    const slug = searchParams.get("district")?.trim().toLowerCase();
    if (slug && getDistrictBySlug(slug)) {
      selectDistrict(slug);
      if (typeof window !== "undefined" && window.location.pathname === "/") {
        window.history.replaceState(null, "", districtHomeHref(slug));
      }
    }
  }, [ready, searchParams, selectDistrict, selectPlace, setLiteModePreference, setUiLanguage]);

  return null;
}
