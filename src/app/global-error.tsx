"use client";

import { useEffect, useState } from "react";
import { getDictionary, type SupportedLocale } from "@/lib/i18n";

function readStoredLocale(): SupportedLocale {
  try {
    const raw = window.localStorage.getItem("uw:preferences");
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { state?: { uiLanguage?: string } };
    return parsed?.state?.uiLanguage === "lg" ? "lg" : "en";
  } catch {
    return "en";
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<SupportedLocale>("en");

  useEffect(() => {
    setLocale(readStoredLocale());
    // Dynamic import so the Sentry client SDK only ships to the browser
    // when it's actually configured — see src/instrumentation-client.ts.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  const dict = getDictionary(locale);

  return (
    <html lang={locale} style={{ backgroundColor: "#12101a", color: "#f7f4ef" }}>
      <body
        style={{
          backgroundColor: "#12101a",
          color: "#f7f4ef",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ fontSize: "17px", opacity: 0.85 }}>{dict.common.globalErrorTitle}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            borderRadius: "9999px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#f7f4ef",
            padding: "0.6rem 1.2rem",
            fontSize: "15px",
          }}
        >
          {dict.common.globalErrorRetry}
        </button>
      </body>
    </html>
  );
}
