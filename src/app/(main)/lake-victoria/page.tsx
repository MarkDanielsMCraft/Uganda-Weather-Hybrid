import type { Metadata } from "next";
import { LakeVictoriaPageClient } from "@/components/lake/LakeVictoriaPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Wave height, wind, and fishing safety conditions for Lake Victoria's Ugandan shoreline, including Kalangala, Entebbe, Jinja, and Masaka.";

export const metadata: Metadata = buildPageMetadata({
  title: "Lake Victoria Fishing Safety",
  description: DESCRIPTION,
  path: "/lake-victoria",
  languagePaths: { en: "/lake-victoria", lg: "/lg/lake-victoria" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Victoria",
  path: "/lake-victoria",
  description: DESCRIPTION,
  coordinates: { lat: -0.45, lon: 32.5 },
});

export default function LakeVictoriaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <LakeVictoriaPageClient />
    </>
  );
}
