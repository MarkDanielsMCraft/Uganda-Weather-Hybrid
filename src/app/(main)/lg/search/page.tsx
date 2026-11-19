import type { Metadata } from "next";
import { SearchPageClient } from "@/components/search/SearchPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Noonya Ebifo",
  description:
    "Noonya buli disitulikiti, kyalo, oba kabuga mu Uganda olabe embeera y'obudde eya leero.",
  path: "/lg/search",
  locale: "lg",
  languagePaths: { en: "/search", lg: "/lg/search" },
});

export default function LugandaSearchPage() {
  return <SearchPageClient />;
}
