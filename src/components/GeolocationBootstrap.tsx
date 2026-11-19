"use client";

import { useEffect, useRef } from "react";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { createGpsPlaceLocation } from "@/lib/places/district-from-place";
import { isWithinUganda } from "@/lib/places/uganda-bounds";
import { isNativeApp } from "@/lib/native/platform";
import type { PlaceLocation } from "@/lib/places/types";
import { usePreferencesStore } from "@/stores/preferencesStore";

/**
 * True only if location access is already granted.
 * Avoids firing unprompted browser dialogs on web before user interaction.
 */
export async function hasStandingLocationPermission(): Promise<boolean> {
  if (await isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permission = await Geolocation.checkPermissions();
    return permission.location === "granted";
  }

  if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch {
    return false;
  }
}

export async function resolvePlaceFromCoords(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<PlaceLocation | null> {
  try {
    const response = await fetch(`/api/v1/locations/reverse?lat=${lat}&lon=${lon}`, { signal });
    if (response.ok) {
      const payload = await response.json();
      if (payload.data?.place) {
        return payload.data.place as PlaceLocation;
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted || (err as { name?: string })?.name === "AbortError") {
      return null;
    }
    // Fall back to coarse GPS place below.
  }
  return createGpsPlaceLocation(lat, lon);
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Minimum distance in kilometres before triggering a place re-resolution.
// 2 km is sensitive enough to catch travel between towns and district boundaries
// while ignoring minor GPS drift when stationary.
export const MIN_MOVE_KM = 2;

/**
 * Automatically tracks user location and updates local weather when moving
 * across districts or places. Hooks into continuous GPS watch and app resume events.
 */
export function GeolocationBootstrap() {
  const hasHydrated = usePreferencesStore((state) => state._hasHydrated);
  const { selectPlace } = useDistrictNavigation();
  const lastResolvedRef = useRef<{ lat: number; lon: number } | null>(null);
  const isWatchingRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    let cancelled = false;
    let webWatchId: number | null = null;
    let nativeWatchId: string | null = null;
    let activeRequestId = 0;

    async function handleUpdate(lat: number, lon: number) {
      if (!isWithinUganda(lat, lon)) return;
      const last = lastResolvedRef.current;
      if (last && haversineKm(last, { lat, lon }) < MIN_MOVE_KM) return;
      lastResolvedRef.current = { lat, lon };

      // Prevent overwriting manual district searches:
      // Auto-tracking only applies if user is currently in GPS tracking mode.
      const currentPlace = usePreferencesStore.getState().activePlace;
      if (!currentPlace?.key.startsWith("gps-")) {
        return;
      }

      const requestId = ++activeRequestId;
      const place = await resolvePlaceFromCoords(lat, lon);
      if (requestId !== activeRequestId || cancelled) return;

      const latestPlace = usePreferencesStore.getState().activePlace;
      if (place && latestPlace?.key.startsWith("gps-")) {
        selectPlace(place);
      }
    }

    async function fetchCurrentPosition() {
      if (cancelled) return;
      const granted = await hasStandingLocationPermission();
      if (!granted) return;

      if (await isNativeApp()) {
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 8000,
          });
          if (pos?.coords && !cancelled) {
            await handleUpdate(pos.coords.latitude, pos.coords.longitude);
          }
        } catch {
          // Keep current place on lookup error
        }
        return;
      }

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) void handleUpdate(pos.coords.latitude, pos.coords.longitude);
          },
          () => undefined,
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 },
        );
      }
    }

    async function startWatching() {
      if (isWatchingRef.current || cancelled) return;
      const granted = await hasStandingLocationPermission();
      if (!granted || cancelled) return;

      isWatchingRef.current = true;
      // Immediately resolve current location on startup
      void fetchCurrentPosition();

      if (await isNativeApp()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        nativeWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: false, timeout: 10000 },
          (position) => {
            if (position?.coords) {
              void handleUpdate(position.coords.latitude, position.coords.longitude);
            }
          },
        );
        return;
      }

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        webWatchId = navigator.geolocation.watchPosition(
          (position) => void handleUpdate(position.coords.latitude, position.coords.longitude),
          () => undefined,
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 },
        );
      }
    }

    // Try starting if permission is already granted
    void startWatching();

    // Listen for permission granted events dispatched after user consent
    const handlePermissionGranted = () => {
      void startWatching();
    };

    // Listen for app resume / tab focus to detect location changes during travel
    const handleAppResumed = () => {
      void fetchCurrentPosition();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void fetchCurrentPosition();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("uw:location-permission-granted", handlePermissionGranted);
      window.addEventListener("uw:app-resumed", handleAppResumed);
      window.addEventListener("focus", handleAppResumed);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      isWatchingRef.current = false;
      if (webWatchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      if (nativeWatchId != null) {
        void import("@capacitor/geolocation").then(({ Geolocation }) =>
          Geolocation.clearWatch({ id: nativeWatchId! }),
        );
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("uw:location-permission-granted", handlePermissionGranted);
        window.removeEventListener("uw:app-resumed", handleAppResumed);
        window.removeEventListener("focus", handleAppResumed);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [hasHydrated, selectPlace]);

  return null;
}
