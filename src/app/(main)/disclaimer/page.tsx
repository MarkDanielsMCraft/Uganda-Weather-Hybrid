import type { Metadata } from "next";
import { LegalPageView } from "@/components/layout/LegalContent";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Disclaimer",
  description: "Forecast limitations and official weather authority for Uganda.",
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return <LegalPageView page="disclaimer" />;
}
