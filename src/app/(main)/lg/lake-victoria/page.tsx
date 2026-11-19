import type { Metadata } from "next";
import { LakeVictoriaPageClient } from "@/components/lake/LakeVictoriaPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { lakeStructuredData } from "@/lib/seo/structured-data";

const TITLE = "Obukuumi bw'Okuvuba ku Nnyanja Nalubaale (Lake Victoria)";
const DESCRIPTION =
  "Obuwanvu bw'amayengo, empewo, n'obukuumi bw'okuvuba ku lubalama lw'Ennyanja Nalubaale mu Uganda, nga mw'otwalidde Kalangala, Entebbe, Jinja, ne Masaka.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/lg/lake-victoria",
  locale: "lg",
  languagePaths: { en: "/lake-victoria", lg: "/lg/lake-victoria" },
});

const STRUCTURED_DATA = lakeStructuredData({
  name: "Lake Victoria",
  path: "/lg/lake-victoria",
  description: DESCRIPTION,
  coordinates: { lat: -0.45, lon: 32.5 },
  locale: "lg",
  pageTitle: TITLE,
});

export default function LugandaLakeVictoriaPage() {
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
