import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Obulabula bw'Obudde",
  description:
    "Obulabula bw'obudde obw'amaanyi mu Uganda, ng'otwaliddemu amataba, laddu, n'obulabe bw'empewo ey'amaanyi mu disitulikiti yo.",
  path: "/lg/alerts",
  locale: "lg",
  languagePaths: { en: "/alerts", lg: "/lg/alerts" },
});

export default function LugandaAlertsPage() {
  return <HomeScreen autoOpenTileId="alerts" />;
}
