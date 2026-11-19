import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";

function normalizeOfficialDistrictName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+municipal council$/i, "")
    .replace(/\s+town council$/i, "")
    .replace(/\s+city council$/i, "")
    .replace(/\s+district$/i, "")
    .replace(/\s+city$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function districtSlugFromOfficialName(name: string): string | null {
  const normalized = normalizeOfficialDistrictName(name);
  if (!normalized) return null;

  const slugCandidate = normalized.replace(/\s+/g, "-");
  const direct = getDistrictBySlug(slugCandidate);
  if (direct) return direct.slug;

  const citySlug = `${slugCandidate}-city`;
  const city = getDistrictBySlug(citySlug);
  if (city) return city.slug;

  for (const district of getAllDistricts()) {
    const districtNorm = normalizeOfficialDistrictName(district.name);
    if (districtNorm === normalized) return district.slug;
    if (district.name.toLowerCase().startsWith(normalized)) return district.slug;
  }

  return null;
}
