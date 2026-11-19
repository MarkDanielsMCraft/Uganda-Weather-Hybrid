import type { Metadata } from "next";
import { LegalPageView } from "@/components/layout/LegalContent";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Cookies",
  description: "How Uganda Weather uses cookies and local storage on your device.",
  path: "/cookies",
});

export default function CookiesPage() {
  return <LegalPageView page="cookies" />;
}
