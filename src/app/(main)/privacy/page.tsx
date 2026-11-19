import type { Metadata } from "next";
import { LegalPageView } from "@/components/layout/LegalContent";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy",
  description: "What Uganda Weather stores on your device and how forecast lookups work.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPageView page="privacy" />;
}
