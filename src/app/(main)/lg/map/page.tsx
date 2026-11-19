import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Maapu y'Enkuba",
  description:
    "Maapu y'enkuba eya Uganda eraga entambula y'enkuba n'empewo mu disitulikiti yo mu ssaawa eyise n'esaawa ezijja.",
  path: "/lg/map",
  locale: "lg",
  languagePaths: { en: "/map", lg: "/lg/map" },
});

export default function LugandaMapPage() {
  return <HomeScreen autoOpenTileId="map" />;
}
