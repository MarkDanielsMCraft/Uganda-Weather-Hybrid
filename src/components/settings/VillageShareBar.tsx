"use client";

import { useState } from "react";
import { buildSmsHref, buildWhatsAppHref } from "@/lib/places/sms-share";

interface VillageShareBarProps {
  message: string;
  language: "en" | "lg";
}

const LABELS = {
  en: {
    sms: "Share forecast by SMS",
    whatsapp: "Share forecast on WhatsApp",
    copy: "Copy forecast text",
    copied: "Copied",
    copyFailed: "Copy is not available on this phone. Use SMS or WhatsApp.",
  },
  lg: {
    sms: "Weereza obubaka bw'obudde nga SMS",
    whatsapp: "Weereza obubaka bw'obudde ku WhatsApp",
    copy: "Koppa obubaka bw'obudde",
    copied: "Kikopeddwa",
    copyFailed: "Okukoppa tekukola ku ssimu eno. Kozesa SMS oba WhatsApp.",
  },
} as const;

const BUTTON_CLASS =
  "inline-flex min-h-[44px] w-full min-[340px]:flex-1 items-center justify-center rounded-full border border-white/15 bg-white/8 px-2.5 py-2 text-[13px] font-medium text-white/95 transition hover:border-white/28 hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export function VillageShareBar({ message, language }: VillageShareBarProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const labels = LABELS[language];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 min-[340px]:flex-row">
        {/* SMS only on touch devices: on a computer the browser stops to ask
            before opening the Messages app, which looks broken to visitors. */}
        <a
          href={buildSmsHref(message)}
          aria-label={labels.sms}
          data-testid="share-sms"
          className={`${BUTTON_CLASS} pointer-fine:hidden`}
        >
          SMS
        </a>
        <a
          href={buildWhatsAppHref(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={labels.whatsapp}
          className={BUTTON_CLASS}
        >
          WhatsApp
        </a>
        <button type="button" onClick={handleCopy} aria-label={labels.copy} className={BUTTON_CLASS}>
          {copyState === "copied" ? labels.copied : language === "lg" ? "Koppa" : "Copy"}
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-[1em] text-[12px] text-white/70">
        {copyState === "failed" ? labels.copyFailed : ""}
      </p>
    </div>
  );
}
