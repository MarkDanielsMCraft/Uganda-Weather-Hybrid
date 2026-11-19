import type { Metadata } from "next";
import { LakeKyogaPageClient } from "@/components/lake/LakeKyogaPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Wave height, wind, and fishing safety conditions for Lake Kyoga's Ugandan shoreline, including Amolatar and Kayunga.";

export const metadata: Metadata = buildPageMetadata({
  title: "Lake Kyoga Fishing Safety",
  description: DESCRIPTION,
  path: "/lake-kyoga",
  languagePaths: { en: "/lake-kyoga", lg: "/lg/lake-kyoga" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Kyoga",
  path: "/lake-kyoga",
  description: DESCRIPTION,
  coordinates: { lat: 1.5, lon: 33.0 },
});

export default function LakeKyogaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <LakeKyogaPageClient />
    </>
  );
}
