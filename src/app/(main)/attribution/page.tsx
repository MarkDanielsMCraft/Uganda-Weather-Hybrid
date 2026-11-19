import type { Metadata } from "next";
import { LegalPageView } from "@/components/layout/LegalContent";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Attribution",
  description:
    "Data sources, meteorological providers, and map credits for Uganda Weather.",
  path: "/attribution",
});

export default function AttributionPage() {
  return <LegalPageView page="attribution" />;
}
