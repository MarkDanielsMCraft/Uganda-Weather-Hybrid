import type { Metadata } from "next";
import { SearchPageClient } from "@/components/search/SearchPageClient";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Search Places",
  description:
    "Search any district, village, or town in Uganda for its own live weather, including hyperlocal places not listed as a district.",
  path: "/search",
  languagePaths: { en: "/search", lg: "/lg/search" },
});

export default function SearchPage() {
  return <SearchPageClient />;
}
