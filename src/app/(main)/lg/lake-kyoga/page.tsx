import type { Metadata } from "next";
import { LakeKyogaPageClient } from "@/components/lake/LakeKyogaPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const TITLE = "Obukuumi bw'Okuvuba ku Nnyanja Kyoga";
const DESCRIPTION =
  "Obuwanvu bw'amayengo, empewo, n'obukuumi bw'okuvuba ku lubalama lw'Ennyanja Kyoga mu Uganda, nga mw'otwalidde Amolatar ne Kayunga.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/lg/lake-kyoga",
  locale: "lg",
  languagePaths: { en: "/lake-kyoga", lg: "/lg/lake-kyoga" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Kyoga",
  path: "/lg/lake-kyoga",
  description: DESCRIPTION,
  coordinates: { lat: 1.5, lon: 33.0 },
  locale: "lg",
  pageTitle: TITLE,
});

export default function LugandaLakeKyogaPage() {
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
