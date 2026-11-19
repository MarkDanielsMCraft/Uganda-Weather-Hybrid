import type { Metadata } from "next";
import { LakeEdwardPageClient } from "@/components/lake/LakeEdwardPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const TITLE = "Obukuumi bw'Okuvuba ku Nnyanja Edward";
const DESCRIPTION =
  "Obuwanvu bw'amayengo, empewo, n'obukuumi bw'okuvuba ku lubalama lw'Ennyanja Edward mu Uganda, nga mw'otwalidde Kasese ne Rubirizi.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/lg/lake-edward",
  locale: "lg",
  languagePaths: { en: "/lake-edward", lg: "/lg/lake-edward" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Edward",
  path: "/lg/lake-edward",
  description: DESCRIPTION,
  coordinates: { lat: -0.37, lon: 29.83 },
  locale: "lg",
  pageTitle: TITLE,
});

export default function LugandaLakeEdwardPage() {
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
