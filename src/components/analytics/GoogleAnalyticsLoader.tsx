"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";

const measurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-RDD9SSRHF3";

declare global {
  interface Window {
    dataLayer?: unknown[];
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
    function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    }
    gtag("js", new Date());
    gtag("config", measurementId, { anonymize_ip: true });
  }, [hasHydrated, analyticsConsent]);

  return null;
}
