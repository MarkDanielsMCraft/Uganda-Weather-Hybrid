import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Agriculture Advisory",
  description:
    "Season, soil moisture, crop guidance, and weekly rain outlook for farmers across Uganda's agro zones, tailored to your district.",
  path: "/agriculture",
  languagePaths: { en: "/agriculture", lg: "/lg/agriculture" },
});

export default function AgriculturePage() {
  return <HomeScreen autoOpenTileId="agriculture" />;
}
