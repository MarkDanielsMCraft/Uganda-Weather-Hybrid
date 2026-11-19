import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "10 Day Forecast",
  description:
    "Hourly and 10 day weather forecasts for any district or village in Uganda, including rain chance, temperature highs and lows, and wind.",
  path: "/forecast",
  languagePaths: { en: "/forecast", lg: "/lg/forecast" },
});

export default function ForecastPage() {
  return <HomeScreen autoOpenTileId="forecast" />;
}
