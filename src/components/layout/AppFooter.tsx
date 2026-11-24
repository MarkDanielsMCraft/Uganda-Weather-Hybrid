"use client";

import { useId, useRef } from "react";
import { SystemStatusIndicator } from "@/components/layout/SystemStatusIndicator";
import {
  AttributionContent,
  CookiesContent,
  DisclaimerContent,
  PrivacyContent,
  TermsContent,
} from "@/components/layout/LegalContent";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useTranslation } from "@/lib/i18n";

const LEGAL_LINKS = [
  { id: "disclaimer", label: "Disclaimer", title: "Disclaimer", Content: DisclaimerContent },
  { id: "privacy", label: "Privacy", title: "Privacy", Content: PrivacyContent },
  { id: "terms", label: "Terms", title: "Terms", Content: TermsContent },
  { id: "cookies", label: "Cookies", title: "Cookies", Content: CookiesContent },
  { id: "attribution", label: "Attribution", title: "Attribution", Content: AttributionContent },
] as const;

/** Every footer link opens the shared detail sheet in place, matching the
    rest of the app's "no click leaves this screen" rule — the dedicated
    /disclaimer, /privacy, etc. pages still exist and still render full
    standalone content for direct links and search engines, this is just
    the footer's own entry point onto that same content. */
export function AppFooter() {
  const { dict } = useTranslation();
  const groupId = useId();
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { openSheet } = useDetailSheet();
  const { isInstalled, triggerInstall } = useInstallPrompt();

  const legalLabels: Record<string, string> = {
    disclaimer: dict.legal.disclaimer,
    privacy: dict.legal.privacy,
    terms: dict.legal.terms,
    cookies: dict.legal.cookies,
    attribution: dict.legal.attributionTitle,
  };

  function openLegal(link: (typeof LEGAL_LINKS)[number]) {
    const anchorEl = buttonRefs.current[link.id] ?? null;
    const openDisclaimerLink = LEGAL_LINKS.find((item) => item.id === "disclaimer");
    const localizedTitle = legalLabels[link.id] ?? link.title;
    openSheet({
      tileId: `${groupId}-${link.id}`,
      title: localizedTitle,
      anchorEl,
      content:
        link.id === "attribution" && openDisclaimerLink ? (
          <AttributionContent onOpenDisclaimer={() => openLegal(openDisclaimerLink)} />
        ) : (
          <link.Content />
        ),
    });
  }

  return (
    <footer className="text-on-sky mt-8 border-t border-white/12 bg-black/38 px-4 pt-6 pb-24 text-center text-[12px] leading-relaxed text-white/80 sm:pb-10">
      {!isInstalled && (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-green/65 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4 shrink-0 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 14.5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm6.293-3.793a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 7.586V3a1 1 0 10-2 0v4.586L7.707 6.293a1 1 0 00-1.414 1.414l3 3z"
                clipRule="evenodd"
              />
            </svg>
            <span>{dict.common.downloadApp}</span>
          </button>
        </div>
      )}
      <p>{dict.legal.attribution}</p>
      <p className="mt-2">
        <SystemStatusIndicator />
      </p>
      <p className="mt-2 space-x-3">
        {LEGAL_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            ref={(el) => {
              buttonRefs.current[link.id] = el;
            }}
            onClick={() => openLegal(link)}
            className="text-white/85 hover:text-white"
          >
            {legalLabels[link.id] ?? link.label}
          </button>
        ))}
      </p>
      <p className="mt-3">
        {dict.legalPages.madeWithPrefix}{" "}
        <a
          href="https://www.mcraftportfolio.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/75 underline-offset-2 hover:text-white hover:underline"
        >
          MCraft
        </a>
      </p>
    </footer>
  );
}
