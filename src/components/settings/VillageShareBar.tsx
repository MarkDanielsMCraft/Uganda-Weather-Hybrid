"use client";

import { useState } from "react";
import { buildSmsHref, buildWhatsAppHref } from "@/lib/places/sms-share";

interface VillageShareBarProps {
  message: string;
  language: "en" | "lg";
  compact?: boolean;
}

export function VillageShareBar({
  message,
  language,
  compact = false,
}: VillageShareBarProps) {
  const [copied, setCopied] = useState(false);
  const isLg = language === "lg";
  const smsHref = buildSmsHref(message);
  const waHref = buildWhatsAppHref(message);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable on basic browsers; SMS and WhatsApp links still work
    }
  };

  if (compact) {
    const compactClass =
      "inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/85 transition hover:border-white/25 hover:text-white";
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={smsHref} className={compactClass}>
          SMS
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={compactClass}
        >
          WhatsApp
        </a>
        <button type="button" onClick={handleCopy} className={compactClass}>
          {copied ? (isLg ? "Kikopeddwa" : "Copied") : isLg ? "Koppa" : "Copy"}
        </button>
      </div>
    );
  }

  const buttonClass =
    "inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-white/15 bg-white/8 px-2.5 py-2 text-[13px] font-medium text-white/95 transition hover:border-white/28 hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  return (
    <div className="grid grid-cols-3 gap-2">
      <a href={smsHref} className={buttonClass}>
        SMS
      </a>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
      >
        WhatsApp
      </a>
      <button type="button" onClick={handleCopy} className={buttonClass}>
        {copied ? (isLg ? "Kikopeddwa" : "Copied") : isLg ? "Koppa" : "Copy"}
      </button>
    </div>
  );
}
