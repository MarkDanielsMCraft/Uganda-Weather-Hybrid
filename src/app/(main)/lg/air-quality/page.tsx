import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Omutindo gw'Empewo",
  description:
    "Omutindo gw'empewo ey'okussa mu Uganda, ng'otwaliddemu PM2.5, PM10, ne ozone, wamu n'amagezi g'ebyobulamu mu disitulikiti yo.",
  path: "/lg/air-quality",
  locale: "lg",
  languagePaths: { en: "/air-quality", lg: "/lg/air-quality" },
});

export default function LugandaAirQualityPage() {
  return <HomeScreen autoOpenTileId="air-quality" />;
}
