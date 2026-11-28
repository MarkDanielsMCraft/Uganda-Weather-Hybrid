import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";
import { CapacitorBootstrap } from "@/components/native/CapacitorBootstrap";
import { PushDistrictSync } from "@/components/native/PushDistrictSync";
import { PushNotificationBootstrap } from "@/components/native/PushNotificationBootstrap";
import { DistrictQuerySync } from "@/components/layout/DistrictQuerySync";
import { PreferencesBootstrap } from "@/components/layout/PreferencesBootstrap";
import { GeolocationBootstrap } from "@/components/GeolocationBootstrap";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { StyleGuard } from "@/components/StyleGuard";
import { GoogleAnalyticsLoader } from "@/components/analytics/GoogleAnalyticsLoader";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { OG_IMAGE_ALT, ogImageUrl } from "@/lib/seo/metadata";
import "./globals.css";

const CRITICAL_STYLES = {
  backgroundColor: "#12101a",
  color: "#f7f4ef",
  minHeight: "100dvh",
} as const;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://uganda-weather.com";
const isHybridSubdomain = /^https?:\/\/hybrid\./i.test(appUrl);
const DEFAULT_DESCRIPTION =
  "Live, district level weather for all 152 districts of Uganda: hourly and 10 day forecasts, severe weather alerts, air quality, agriculture advisories, fishing safety for four lakes, national park and mountain weather, and airport conditions.";
const defaultOgImage = ogImageUrl(appUrl.replace(/\/$/, ""));

/** Bump whenever the mark is redrawn. See the `icons` note below. */
const ICON_VERSION = "9";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: "./",
  },
  title: {
    default: "Uganda Weather",
    template: "%s | Uganda Weather",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "Uganda Weather",
  keywords: [
    "Uganda weather",
    "Uganda forecast",
    "Kampala weather",
    "Lake Victoria fishing safety",
    "Uganda weather alerts",
    "Uganda air quality",
    "district weather Uganda",
  ],
  creator: "MCraft",
  publisher: "MCraft",
  robots: {
    index: !isHybridSubdomain,
    follow: !isHybridSubdomain,
    // Keep the standalone hybrid subdomain out of search indexes so it does not
    // duplicate pages from the main uganda-weather.com site, while keeping full
    // snippets enabled whenever built for the main domain.
    googleBot: {
      index: !isHybridSubdomain,
      follow: !isHybridSubdomain,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Declared explicitly rather than left to the file convention, which
  // emitted `<link rel="icon" href="/favicon.ico">` with no cache key and
  // announced the file as holding only a 16px image. Browsers cache a
  // favicon by URL and hold onto it hard, so a redrawn mark at an
  // unchanged URL kept showing the old icon. ICON_VERSION changes the URL
  // whenever the mark is redrawn, and the SVG is offered first so anything
  // modern takes the resolution independent one.
  icons: {
    icon: [
      { url: `/icon.svg?v=${ICON_VERSION}`, type: "image/svg+xml", sizes: "any" },
      { url: `/icons/icon-192.png?v=${ICON_VERSION}`, type: "image/png", sizes: "192x192" },
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "16x16 32x32 48x48" },
    ],
    apple: [
      { url: `/icons/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180", type: "image/png" },
      { url: `/icons/icon-192.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
    ],
  },
  // Absent entirely (no empty meta tag shipped) until the real codes
  // exist. Search Console and Bing Webmaster Tools each hand you a
  // one-line code from their site verification page; set it as an env
  // var and it appears here automatically, no code change needed.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
  openGraph: {
    title: "Uganda Weather",
    description: DEFAULT_DESCRIPTION,
    siteName: "Uganda Weather",
    locale: "en_UG",
    type: "website",
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Uganda Weather",
    description: DEFAULT_DESCRIPTION,
    images: [defaultOgImage],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Uganda Weather",
  },
  formatDetection: {
    telephone: false,
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      // Stable @id so each district page's WebPage node can declare itself
      // part of this site instead of floating unattached in the graph.
      "@id": `${appUrl.replace(/\/$/, "")}/#website`,
      name: "Uganda Weather",
      url: appUrl,
      description: DEFAULT_DESCRIPTION,
      inLanguage: ["en-UG", "lg-UG"],
      // Country level half of the local SEO signal; district pages carry the
      // place level half via their own Place/GeoCoordinates nodes.
      spatialCoverage: { "@type": "Country", name: "Uganda" },
      potentialAction: {
        "@type": "SearchAction",
        target: `${appUrl.replace(/\/$/, "")}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: "Uganda Weather",
      url: appUrl,
      founder: { "@type": "Person", name: "MCraft" },
      areaServed: { "@type": "Country", name: "Uganda" },
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1524",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={CRITICAL_STYLES}>
      <body className="antialiased" style={CRITICAL_STYLES}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <StyleGuard />
        <QueryProvider>
          <PreferencesBootstrap />
          <Suspense fallback={null}>
            <DistrictQuerySync />
          </Suspense>
          <PushDistrictSync />
          <PushNotificationBootstrap />
          <GeolocationBootstrap />
          <ServiceWorkerRegister />
          {/* Cookieless, aggregate-only. No consent gating needed (see ADR-006). */}
          {(process.env.VERCEL === "1" || Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV)) && (
            <>
              <SpeedInsights />
              <Analytics />
            </>
          )}
          <GoogleAnalyticsLoader />
          <DetailSheetProvider>
            <CapacitorBootstrap />
            {children}
          </DetailSheetProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
