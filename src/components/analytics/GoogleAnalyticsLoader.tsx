"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";

// No built in fallback ID: without the env var, analytics stays off rather
// than sending this site's visits into another property.
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Loads Google Analytics only once both conditions are true: a
    measurement ID is configured, and the visitor has explicitly accepted
    non-essential cookies in the cookie banner. Never loads on a first
    visit before the banner has been answered, and never loads at all for
    a visitor who chose "Essential only" (see ADR-006). Unlike Vercel
    Analytics/Speed Insights, GA sets cookies for cross-session tracking,
    which is what makes consent required here specifically. */
export function GoogleAnalyticsLoader() {
  const analyticsConsent = usePreferencesStore((state) => state.analyticsConsent);
  const hasHydrated = usePreferencesStore((state) => state._hasHydrated);

  useEffect(() => {
    if (!measurementId || !hasHydrated || analyticsConsent !== true) return;
    if (document.getElementById("ga-script")) return;

    const script = document.createElement("script");
    script.id = "ga-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      // gtag.js requires native `Arguments` entries in dataLayer rather than plain arrays.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    }
    window.gtag = gtag as (...args: unknown[]) => void;
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
  }, [hasHydrated, analyticsConsent]);

  return null;
}
