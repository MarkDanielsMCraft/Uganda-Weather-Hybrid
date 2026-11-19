import { findNearestDistrict } from "@/lib/districts";
import { isNativeApp } from "./platform";

export async function getCurrentCoordinates(): Promise<{ lat: number; lon: number } | null> {
  if (await isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permission = await Geolocation.checkPermissions();
    if (permission.location === "denied") return null;

    if (permission.location !== "granted") {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== "granted") return null;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8000,
    });

    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }),
      () => resolve(null),
      { maximumAge: 600_000, timeout: 8000 },
    );
  });
}

export async function nearestDistrictFromDevice() {
  const coords = await getCurrentCoordinates();
  if (!coords) return null;
  return findNearestDistrict(coords.lat, coords.lon);
}
