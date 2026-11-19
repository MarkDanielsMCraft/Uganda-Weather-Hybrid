import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Severe Weather Alerts",
  description:
    "Severe weather alerts and hazard warnings for Uganda, including flood, lightning, and storm risk for your district.",
  path: "/alerts",
  languagePaths: { en: "/alerts", lg: "/lg/alerts" },
});

export default function AlertsPage() {
  return <HomeScreen autoOpenTileId="alerts" />;
}
