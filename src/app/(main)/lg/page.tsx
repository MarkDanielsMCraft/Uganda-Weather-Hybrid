import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

const LUGANDA_DESCRIPTION =
  "Embeera y'obudde eya leero mu disitulikiti zonna 152 eza Uganda: essaawa ku ssaawa n'ennaku 10, obulabula bw'obudde, omutindo gw'empewo, ebyobulimi, obukuumi bw'oku nnyanja nnya, n'ebisaawe by'ennyonyi.";

export const metadata: Metadata = buildPageMetadata({
  title: "Uganda Weather | Embeera y'obudde mu Uganda",
  description: LUGANDA_DESCRIPTION,
  path: "/lg",
  locale: "lg",
  languagePaths: { en: "/", lg: "/lg" },
});

export default function LugandaHomePage() {
  return <HomeScreen />;
}
