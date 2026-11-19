import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Air Quality",
  description:
    "Current air quality index and pollutant breakdown for Uganda, including PM2.5, PM10, and ozone, with health guidance for your district.",
  path: "/air-quality",
  languagePaths: { en: "/air-quality", lg: "/lg/air-quality" },
});

export default function AirQualityPage() {
  return <HomeScreen autoOpenTileId="air-quality" />;
}
