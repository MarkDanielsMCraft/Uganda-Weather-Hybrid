import type { Region } from "@/types/weather";

export const REGION_STYLES: Record<
  Region,
  { label: string; accent: string; soft: string; gradient: string }
> = {
  central: {
    label: "Central",
    accent: "#1B8A7A",
    soft: "rgba(27, 138, 122, 0.22)",
    gradient: "from-[#1B8A7A]/35 to-transparent",
  },
  eastern: {
    label: "Eastern",
    accent: "#E8A838",
    soft: "rgba(232, 168, 56, 0.22)",
    gradient: "from-[#E8A838]/30 to-transparent",
  },
  northern: {
    label: "Northern",
    accent: "#E07A5F",
    soft: "rgba(224, 122, 95, 0.22)",
    gradient: "from-[#E07A5F]/28 to-transparent",
  },
  western: {
    label: "Western",
    accent: "#2D6A4F",
    soft: "rgba(45, 106, 79, 0.24)",
    gradient: "from-[#2D6A4F]/32 to-transparent",
  },
};

export function getRegionStyle(region: Region) {
  return REGION_STYLES[region];
}
