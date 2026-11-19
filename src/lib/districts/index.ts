import districtsData from "../../../data/districts/uganda-districts.json";
import type { District, Region } from "@/types/weather";

interface DistrictsFile {
  districts: District[];
}

const { districts } = districtsData as DistrictsFile;

export function getAllDistricts(region?: Region): District[] {
  if (!region) return [...districts];
  return districts.filter((d) => d.region === region);
}

export function getDistrictBySlug(slug: string): District | undefined {
  return districts.find((d) => d.slug === slug);
}

export function searchDistricts(query: string, limit = 10) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return districts
    .map((district) => {
      const name = district.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (district.slug.includes(q)) score = 40;
      return { district, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.district.name.localeCompare(b.district.name))
    .reduce<{ district: District; score: number }[]>((acc, item) => {
      const base = item.district.name.replace(/\s+City$/i, "").toLowerCase();
      const existing = acc.find(
        (entry) => entry.district.name.replace(/\s+City$/i, "").toLowerCase() === base,
      );
      if (!existing) {
        acc.push(item);
        return acc;
      }
      if (item.district.isCity && !existing.district.isCity) {
        const index = acc.indexOf(existing);
        acc[index] = item;
      }
      return acc;
    }, [])
    .slice(0, limit)
    .map(({ district, score }) => ({
      name: district.name,
      slug: district.slug,
      region: district.region,
      matchScore: score,
    }));
}

export function getPopularDistricts(limit = 5): District[] {
  const byRank = new Map<number, District[]>();

  for (const district of districts) {
    if (district.popularRank == null) continue;
    const group = byRank.get(district.popularRank) ?? [];
    group.push(district);
    byRank.set(district.popularRank, group);
  }

  return [...byRank.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group.find((d) => d.isCity) ?? group[0])
    .slice(0, limit);
}

/** Uganda's 11 gazetted cities (Kampala plus the 10 municipalities elevated
    to city status in 2020-2021 — Arua, Fort Portal, Gulu, Hoima, Jinja,
    Lira, Masaka, Mbale, Mbarara, Soroti) plus a handful of other major
    towns/districts worth surfacing at a glance. Used by the TopBar's city
    strip so it isn't capped at whatever popularRank happened to be
    assigned — getPopularDistricts alone was missing Arua, Fort Portal,
    Hoima, Lira, Masaka and Soroti entirely, none of which had a rank set. */
export function getMajorLocations(): District[] {
  const cities = districts.filter((d) => d.isCity);
  const extraSlugs = ["bukomansimbi"];
  const extras = extraSlugs
    .map((slug) => getDistrictBySlug(slug))
    .filter((d): d is District => Boolean(d));
  const rankedExtras = getPopularDistricts(12).filter(
    (d) => !d.isCity && !extraSlugs.includes(d.slug),
  );

  const seen = new Set<string>();
  const combined: District[] = [];
  for (const district of [...cities, ...extras, ...rankedExtras]) {
    if (seen.has(district.slug)) continue;
    seen.add(district.slug);
    combined.push(district);
  }
  return combined;
}

export function findNearestDistrict(lat: number, lon: number): District {
  let nearest = districts[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const district of districts) {
    const dLat = district.coordinates.lat - lat;
    const dLon = district.coordinates.lon - lon;
    const distance = dLat * dLat + dLon * dLon;
    if (distance < minDistance) {
      minDistance = distance;
      nearest = district;
    }
  }

  return nearest;
}
