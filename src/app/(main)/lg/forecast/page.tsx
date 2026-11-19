import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Okuteebereza kw'Ennaku 10",
  description:
    "Embeera y'obudde essaawa ku ssaawa n'ennaku 10 mu buli disitulikiti oba kyalo mu Uganda, ng'otwaliddemu emikisa gy'enkuba, ebbugumu, n'empewo.",
  path: "/lg/forecast",
  locale: "lg",
  languagePaths: { en: "/forecast", lg: "/lg/forecast" },
});

export default function LugandaForecastPage() {
  return <HomeScreen autoOpenTileId="forecast" />;
}
