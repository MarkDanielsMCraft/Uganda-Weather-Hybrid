import type { PlaceLocation } from "@/lib/places/types";
import { createPlaceLocation } from "@/lib/places/district-from-place";

export type DeepLinkLocation =
  | { kind: "district"; slug: string }
  | { kind: "place"; place: PlaceLocation };

const MODULE_SEGMENTS = new Set([
  "alerts",
  "forecast",
  "map",
  "air-quality",
  "agriculture",
  "lake-victoria",
  "search",
]);

export interface ParsedDeepLink {
  location: DeepLinkLocation | null;
  modulePath: string | null;
  alertId: string | null;
}

function locationFromParams(parsed: URL): DeepLinkLocation | null {
  if (parsed.protocol === "ugandaweather:") {
    const parts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts[0] === "district" && parts[1]) {
      return { kind: "district", slug: parts[1].toLowerCase() };
    }
    if (parts[0] === "place" && parts[1]) {
      const name = parsed.searchParams.get("name");
      const lat = Number(parsed.searchParams.get("lat"));
      const lon = Number(parsed.searchParams.get("lon"));
      if (name && Number.isFinite(lat) && Number.isFinite(lon)) {
        return {
          kind: "place",
          place: createPlaceLocation({
            name,
            lat,
            lon,
            label: parsed.searchParams.get("label") ?? undefined,
            parentDistrictSlug: parsed.searchParams.get("parent")?.toLowerCase() ?? undefined,
          }),
        };
      }
    }
  }

  const placeName = parsed.searchParams.get("name")?.trim();
  const lat = Number(parsed.searchParams.get("lat"));
  const lon = Number(parsed.searchParams.get("lon"));
  if (parsed.searchParams.get("place") && placeName && Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      kind: "place",
      place: createPlaceLocation({
        name: placeName,
        lat,
        lon,
        label: parsed.searchParams.get("label") ?? undefined,
        parentDistrictSlug: parsed.searchParams.get("parent")?.toLowerCase() ?? undefined,
      }),
    };
  }

  const fromQuery = parsed.searchParams.get("district");
  if (fromQuery) return { kind: "district", slug: fromQuery.toLowerCase() };

  const pathMatch = parsed.pathname.match(/\/district\/([a-z0-9-]+)/i);
  if (pathMatch?.[1]) return { kind: "district", slug: pathMatch[1].toLowerCase() };

  return null;
}

function modulePathFromParsed(parsed: URL): string | null {
  if (parsed.protocol === "ugandaweather:") {
    const segment = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean)[0];
    if (segment && MODULE_SEGMENTS.has(segment)) {
      if (segment === "lake-victoria") {
        const shore = parsed.searchParams.get("shore");
        if (shore) return `/lake-victoria?shore=${encodeURIComponent(shore)}`;
      }
      return `/${segment}`;
    }
    return null;
  }

  const match = parsed.pathname.match(
    /^\/(alerts|forecast|map|air-quality|agriculture|lake-victoria|search)\/?$/,
  );
  if (!match?.[1]) return null;
  if (match[1] === "lake-victoria") {
    const shore = parsed.searchParams.get("shore");
    if (shore) return `/lake-victoria?shore=${encodeURIComponent(shore)}`;
  }
  return `/${match[1]}`;
}

export function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(url);
    return {
      location: locationFromParams(parsed),
      modulePath: modulePathFromParsed(parsed),
      alertId: parsed.searchParams.get("alert")?.trim() || null,
    };
  } catch {
    return null;
  }
}

export function locationFromDeepLink(url: string): DeepLinkLocation | null {
  return parseDeepLink(url)?.location ?? null;
}

/** @deprecated Use locationFromDeepLink */
export function districtSlugFromDeepLink(url: string): string | null {
  const location = locationFromDeepLink(url);
  return location?.kind === "district" ? location.slug : null;
}

export function districtPath(slug: string) {
  return `ugandaweather://district/${slug}`;
}

export function placePath(
  place: Pick<PlaceLocation, "key" | "name" | "lat" | "lon" | "label" | "parentDistrictSlug">,
) {
  const params = new URLSearchParams({
    name: place.name,
    lat: String(place.lat),
    lon: String(place.lon),
    label: place.label,
    parent: place.parentDistrictSlug,
  });
  return `ugandaweather://place/${place.key}?${params.toString()}`;
}

export function alertsPath(districtSlug: string, alertId?: string) {
  const params = new URLSearchParams({ district: districtSlug });
  if (alertId) params.set("alert", alertId);
  return `/alerts?${params.toString()}`;
}

export function moduleDeepLink(path: string, districtSlug?: string, alertId?: string) {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const params = new URLSearchParams();
  if (districtSlug) params.set("district", districtSlug);
  if (alertId) params.set("alert", alertId);
  const query = params.toString();
  return query ? `ugandaweather://${normalized}?${query}` : `ugandaweather://${normalized}`;
}

/** An alert can carry the page to open. Only paths inside this app are
    allowed, so a route such as "//other.site" or "https://..." can never
    send someone to another website from a trusted storm alert. */
export function safeAlertRoute(route: unknown): string {
  if (typeof route !== "string") return "/alerts";
  const trimmed = route.trim();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (path.startsWith("//") || path.includes("\\") || /^\/[^/?#]*:/.test(path)) return "/alerts";
  // "/.//other.site" becomes "//other.site" once the dots are resolved.
  if (path.split(/[?#]/)[0]!.split("/").some((part) => part === "." || part === "..")) return "/alerts";
  if (!/^\/[A-Za-z0-9/_\-?=&.%#]*$/.test(path) || path.length > 200) return "/alerts";
  return path;
}
