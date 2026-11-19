"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getDistrictBySlug } from "@/lib/districts";
import { createPlaceLocation } from "@/lib/places/district-from-place";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { districtHomeHref } from "@/lib/places/share";
import { useAppReady } from "@/hooks/useAppReady";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Sync `?district=` and `?place=` URL params into persisted preferences. */
export function DistrictQuerySync() {
  const ready = useAppReady();
  const searchParams = useSearchParams();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);
  const selectPlace = usePreferencesStore((state) => state.selectPlace);

  useEffect(() => {
    if (!ready) return;

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
  }, [ready, searchParams, selectDistrict, selectPlace]);

  return null;
}
