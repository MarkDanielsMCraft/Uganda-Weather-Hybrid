import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Rain Radar Map",
  description:
    "Live precipitation radar for Uganda, showing rain and storm movement over your district for the past hour and the near term forecast.",
  path: "/map",
  languagePaths: { en: "/map", lg: "/lg/map" },
});

export default function MapPage() {
  return <HomeScreen autoOpenTileId="map" />;
}
