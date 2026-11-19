import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

const DEFAULT_DESCRIPTION =
  "Live, district level weather for all 152 districts of Uganda: hourly and 10 day forecasts, severe weather alerts, air quality, agriculture advisories, fishing safety for four lakes, national park and mountain weather, and airport conditions.";

export const metadata: Metadata = buildPageMetadata({
  title: "Uganda Weather",
  description: DEFAULT_DESCRIPTION,
  path: "/",
  languagePaths: { en: "/", lg: "/lg" },
});

export default function HomePage() {
  return <HomeScreen />;
}
