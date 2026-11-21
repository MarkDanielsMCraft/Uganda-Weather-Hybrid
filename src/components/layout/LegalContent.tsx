"use client";

import Link from "next/link";
import { GlassPanel } from "@/components/glass/GlassCard";
import { WeatherListenButton } from "@/components/settings/WeatherListenButton";
import { SheetSection } from "@/components/sheet/SheetSection";
import { SOURCES } from "@/lib/attribution/sources";
import { useTranslation } from "@/lib/i18n";

export function DisclaimerContent() {
  const { dict } = useTranslation();

  return (
    <div>
      {dict.legalPages.disclaimerParagraphs.map((paragraph, index) => (
        <SheetSection key={index}>
          <p className="text-[14px] leading-relaxed text-white/78">{paragraph}</p>
        </SheetSection>
      ))}
    </div>
  );
}

export function PrivacyContent() {
  const { dict } = useTranslation();

  return (
    <div>
      {dict.legalPages.privacyParagraphs.map((paragraph, index) => (
        <SheetSection key={index}>
          <p className="text-[14px] leading-relaxed text-white/78">{paragraph}</p>
        </SheetSection>
      ))}
      <SheetSection>
        <p className="text-[14px] leading-relaxed text-white/78">
          {dict.legalPages.privacyOperatorPrefix}{" "}
          <a
            href="https://www.mcraftportfolio.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/85 underline-offset-2 hover:text-white hover:underline"
          >
            MCraft
          </a>
          . {dict.legalPages.privacyOperatorSuffix}
        </p>
      </SheetSection>
    </div>
  );
}

export function TermsContent() {
  const { dict } = useTranslation();

  return (
    <div>
      {dict.legalPages.termsParagraphs.map((paragraph, index) => (
        <SheetSection key={index}>
          <p className="text-[14px] leading-relaxed text-white/78">{paragraph}</p>
        </SheetSection>
      ))}
    </div>
  );
}

export function CookiesContent() {
  const { dict } = useTranslation();

  return (
    <div>
      <SheetSection label={dict.legalPages.cookiesEssentialTitle}>
        <p className="text-[14px] leading-relaxed text-white/78">
          {dict.legalPages.cookiesEssentialBody}
        </p>
      </SheetSection>
      <SheetSection label={dict.legalPages.cookiesAnalyticsTitle}>
        <p className="text-[14px] leading-relaxed text-white/78">
          {dict.legalPages.cookiesAnalyticsBody}
        </p>
      </SheetSection>
    </div>
  );
}

export function AttributionContent({ onOpenDisclaimer }: { onOpenDisclaimer?: () => void }) {
  const { dict } = useTranslation();

  return (
    <div>
      {SOURCES.map((source) => (
        <SheetSection key={source.name}>
          <p className="text-[15px] font-medium text-white">{source.name}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            {dict.legalPages.sourceRoles[source.name] ?? source.role}
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[13px] text-white/85 underline-offset-2 hover:text-white hover:underline"
          >
            {source.url.replace(/^https?:\/\//, "")}
          </a>
        </SheetSection>
      ))}
      <SheetSection>
        <p className="text-[14px] leading-relaxed text-white/75">
          {dict.legalPages.attributionFooterPre}{" "}
          {onOpenDisclaimer ? (
            <button
              type="button"
              onClick={onOpenDisclaimer}
              className="text-white/90 underline-offset-2 hover:underline"
            >
              {dict.legalPages.attributionFooterLink}
            </button>
          ) : (
            <Link href="/disclaimer" className="text-white/90 underline-offset-2 hover:underline">
              {dict.legalPages.attributionFooterLink}
            </Link>
          )}{" "}
          {dict.legalPages.attributionFooterPost}
        </p>
      </SheetSection>
    </div>
  );
}

export type LegalPageKind = "disclaimer" | "privacy" | "terms" | "cookies" | "attribution";

export function LegalPageView({ page }: { page: LegalPageKind }) {
  const { dict, uiLanguage } = useTranslation();

  const meta: Record<LegalPageKind, { title: string; subtitle: string }> = {
    disclaimer: {
      title: dict.legal.disclaimer,
      subtitle: dict.legalPages.disclaimerSubtitle,
    },
    privacy: {
      title: dict.legal.privacy,
      subtitle: dict.legalPages.privacySubtitle,
    },
    terms: {
      title: dict.legal.terms,
      subtitle: dict.legalPages.termsSubtitle,
    },
    cookies: {
      title: dict.legal.cookies,
      subtitle: dict.legalPages.cookiesSubtitle,
    },
    attribution: {
      title: dict.legal.attributionTitle,
      subtitle: dict.legalPages.attributionSubtitle,
    },
  };

  const { title, subtitle } = meta[page];

  return (
    <div className="space-y-5 lg:max-w-2xl lg:px-10 lg:py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold tracking-[-0.03rem] text-white">{title}</h1>
          <p className="mt-1 text-[17px] text-white/55">{subtitle}</p>
        </div>
        <WeatherListenButton
          compact
          tileIdOverride={page}
          autoNarrateOnSheetChange
          testId={`legal-listen-${page}`}
        />
      </div>

      {page === "attribution" ? (
        <>
          <GlassPanel>
            {SOURCES.map((source) => (
              <div key={source.name} className="px-4 py-4">
                <p className="text-[17px] font-medium text-white">{source.name}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/60">
                  {dict.legalPages.sourceRoles[source.name] ?? source.role}
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[14px] text-white/85 underline-offset-2 hover:underline"
                >
                  {source.url.replace(/^https?:\/\//, "")}
                </a>
              </div>
            ))}
          </GlassPanel>

          <GlassPanel className="px-4 py-4 text-[15px] leading-relaxed text-white/75">
            <p>
              {dict.legalPages.attributionFooterPre}{" "}
              <Link href="/disclaimer" className="text-white/90 underline-offset-2 hover:underline">
                {dict.legalPages.attributionFooterLink}
              </Link>{" "}
              {dict.legalPages.attributionFooterPost}
            </p>
          </GlassPanel>
        </>
      ) : (
        <GlassPanel className="px-4 py-5">
          {page === "disclaimer" && <DisclaimerContent />}
          {page === "privacy" && <PrivacyContent />}
          {page === "terms" && <TermsContent />}
          {page === "cookies" && <CookiesContent />}
        </GlassPanel>
      )}

      <p className="text-center text-[14px] text-white/45">
        <Link href="/" className="text-white/70 hover:text-white">
          {uiLanguage === "lg" ? dict.common.backToNow : "Back to Now"}
        </Link>
      </p>
    </div>
  );
}
