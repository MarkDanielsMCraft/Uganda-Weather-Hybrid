import type { District } from "@/types/weather";

/** Better centroids for major urban districts (OSM admin boundaries can sit off-centre). */
const WEATHER_COORD_OVERRIDES: Record<string, { lat: number; lon: number }> = {
  kampala: { lat: 0.3136, lon: 32.5811 },
  wakiso: { lat: 0.4038, lon: 32.4592 },
  entebbe: { lat: 0.0512, lon: 32.4634 },
  jinja: { lat: 0.4244, lon: 33.2042 },
  "jinja-city": { lat: 0.4244, lon: 33.2042 },
  mbarara: { lat: -0.6109, lon: 30.6548 },
  "mbarara-city": { lat: -0.6109, lon: 30.6548 },
  gulu: { lat: 2.7746, lon: 32.298 },
  "gulu-city": { lat: 2.7746, lon: 32.298 },
  mbale: { lat: 1.0651, lon: 34.1753 },
  "mbale-city": { lat: 1.0651, lon: 34.1753 },
  "fort-portal-city": { lat: 0.661, lon: 30.274 },
};

const CITY_QUERY_SLUGS = new Set([
  "kampala",
  "wakiso",
  "mukono",
  "entebbe",
  "jinja",
  "jinja-city",
  "mbarara",
  "mbarara-city",
  "gulu",
  "gulu-city",
  "mbale",
  "mbale-city",
  "arua",
  "arua-city",
  "fort-portal-city",
]);

export function coordinatesForWeather(district: District) {
  // A place's slug is the key sent in the address, so a place named "gulu"
  // must never pick up Gulu's fixed point. Places always use their own point,
  // which is also the point their saved weather is filed under.
  if (district.isPlace) return district.coordinates;
  return WEATHER_COORD_OVERRIDES[district.slug] ?? district.coordinates;
}

export function weatherApiQueryForDistrict(district: District) {
  if (district.isPlace) {
    const { lat, lon } = coordinatesForWeather(district);
    return `${lat},${lon}`;
  }
  if (district.isCity || CITY_QUERY_SLUGS.has(district.slug)) {
    const name = district.name.replace(/\s+City$/i, "").trim();
    return `${name}, Uganda`;
  }
  const { lat, lon } = coordinatesForWeather(district);
  return `${lat},${lon}`;
}

export function openMeteoCoordsForDistrict(district: District) {
  return coordinatesForWeather(district);
}

export function weatherTargetQueryString(district: District): string {
  if (district.isPlace) {
    const params = new URLSearchParams({
      place: district.slug,
      name: district.name,
      lat: String(district.coordinates.lat),
      lon: String(district.coordinates.lon),
    });
    if (district.placeLabel) params.set("label", district.placeLabel);
    if (district.parentDistrictSlug) params.set("parent", district.parentDistrictSlug);
    return params.toString();
  }
  return `district=${encodeURIComponent(district.slug)}`;
}
