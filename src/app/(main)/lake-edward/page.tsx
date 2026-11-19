import type { Metadata } from "next";
import { LakeEdwardPageClient } from "@/components/lake/LakeEdwardPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Wave height, wind, and fishing safety conditions for Lake Edward's Ugandan shoreline, including Kasese and Rubirizi.";

export const metadata: Metadata = buildPageMetadata({
  title: "Lake Edward Fishing Safety",
  description: DESCRIPTION,
  path: "/lake-edward",
  languagePaths: { en: "/lake-edward", lg: "/lg/lake-edward" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Edward",
  path: "/lake-edward",
  description: DESCRIPTION,
  coordinates: { lat: -0.37, lon: 29.83 },
});

export default function LakeEdwardPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <LakeEdwardPageClient />
    </>
  );
}
