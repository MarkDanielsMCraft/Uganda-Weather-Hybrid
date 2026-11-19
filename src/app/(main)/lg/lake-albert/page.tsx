import type { Metadata } from "next";
import { LakeAlbertPageClient } from "@/components/lake/LakeAlbertPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const TITLE = "Obukuumi bw'Okuvuba ku Nnyanja Albert";
const DESCRIPTION =
  "Obuwanvu bw'amayengo, empewo, n'obukuumi bw'okuvuba ku lubalama lw'Ennyanja Albert mu Uganda, nga mw'otwalidde Buliisa, Ntoroko, ne Hoima.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/lg/lake-albert",
  locale: "lg",
  languagePaths: { en: "/lake-albert", lg: "/lg/lake-albert" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Albert",
  path: "/lg/lake-albert",
  description: DESCRIPTION,
  coordinates: { lat: 1.67, lon: 31.0 },
  locale: "lg",
  pageTitle: TITLE,
});

export default function LugandaLakeAlbertPage() {
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
