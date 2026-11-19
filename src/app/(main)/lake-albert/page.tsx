import type { Metadata } from "next";
import { LakeAlbertPageClient } from "@/components/lake/LakeAlbertPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Wave height, wind, and fishing safety conditions for Lake Albert's Ugandan shoreline, including Buliisa, Ntoroko, and Hoima.";

export const metadata: Metadata = buildPageMetadata({
  title: "Lake Albert Fishing Safety",
  description: DESCRIPTION,
  path: "/lake-albert",
  languagePaths: { en: "/lake-albert", lg: "/lg/lake-albert" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Albert",
  path: "/lake-albert",
  description: DESCRIPTION,
  coordinates: { lat: 1.67, lon: 31.0 },
});

export default function LakeAlbertPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <LakeAlbertPageClient />
    </>
  );
}
