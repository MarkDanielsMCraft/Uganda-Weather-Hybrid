import type { Metadata } from "next";
import { signOgText } from "@/lib/seo/og-sign";
import { OG_SIGNATURE_PARAM } from "@/lib/seo/og-text";

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://uganda-weather.com").replace(/\/$/, "");
}

/** The image route draws only text that is signed here. Without a secret the
    link still works and shows the plain brand card. */
export function ogImageUrl(base: string, title: string, subtitle: string): string {
  const params = new URLSearchParams({ title, subtitle });
  const signature = signOgText(title, subtitle);
  if (signature) params.set(OG_SIGNATURE_PARAM, signature);
  return `${base}/api/og?${params.toString()}`;
}

/** Builds one consistent Metadata object for a static or dynamic route:
    unique title, description, canonical URL, and an OpenGraph/Twitter
    image pointing at the shared `/api/og` generator so every shared link
    gets its own distinct preview card instead of inheriting the generic
    site wide default. */
export function buildPageMetadata({
  title,
  description,
  path,
  ogTitle,
  ogSubtitle,
  locale = "en",
  languagePaths,
}: {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogSubtitle?: string;
  locale?: "en" | "lg";
  languagePaths?: { en: string; lg: string };
}): Metadata {
  const base = appBaseUrl();
  const canonical = `${base}${path}`;
  const imageUrl = ogImageUrl(base, ogTitle ?? title, ogSubtitle ?? description);
  const isRoot = path === "/" || path === "/lg" || title === "Uganda Weather";

  return {
    title: isRoot ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      ...(languagePaths
        ? {
            languages: {
              "en-UG": `${base}${languagePaths.en}`,
              "lg-UG": `${base}${languagePaths.lg}`,
              "x-default": `${base}${languagePaths.en}`,
            },
          }
        : {}),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Uganda Weather",
      locale: locale === "lg" ? "lg_UG" : "en_UG",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
