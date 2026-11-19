import type { Metadata } from "next";
import { LegalPageView } from "@/components/layout/LegalContent";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Use",
  description: "Terms for using Uganda Weather forecast and alert services.",
  path: "/terms",
});

export default function TermsPage() {
  return <LegalPageView page="terms" />;
}
