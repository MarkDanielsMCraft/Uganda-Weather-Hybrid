import type { Metadata } from "next";

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://uganda-weather.com").replace(/\/$/, "");
}

/** One fixed preview picture for every page, made from the Android splash
    screen. A fixed picture also means nobody can put their own words on a
    Uganda Weather preview by changing an address. */
export const OG_IMAGE_PATH = "/og-image.jpg";
export const OG_IMAGE_ALT = "Map of Uganda in green with a sun, cloud, and rain weather icon";

export function ogImageUrl(base = appBaseUrl()): string {
  return `${base}${OG_IMAGE_PATH}`;
}

/** Builds one consistent Metadata object for a static or dynamic route, with
    its own title, description, and canonical address, and the shared preview
    picture. */
export function buildPageMetadata({
  title,
  description,
  path,
  locale = "en",
  languagePaths,
}: {
  title: string;
  description: string;
  path: string;
  locale?: "en" | "lg";
  languagePaths?: { en: string; lg: string };
}): Metadata {
  const base = appBaseUrl();
  const canonical = `${base}${path}`;
  const imageUrl = ogImageUrl(base);
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
      images: [{ url: imageUrl, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
