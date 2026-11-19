import type { Metadata } from "next";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Amagezi g'Ebyobulimi",
  description:
    "Sizoni, obunnyogovu bw'ettaka, amagezi ku birime, n'enkuba ya wiiki eri abalimi mu bitundu bya Uganda eby'enjawulo.",
  path: "/lg/agriculture",
  locale: "lg",
  languagePaths: { en: "/agriculture", lg: "/lg/agriculture" },
});

export default function LugandaAgriculturePage() {
  return <HomeScreen autoOpenTileId="agriculture" />;
}
