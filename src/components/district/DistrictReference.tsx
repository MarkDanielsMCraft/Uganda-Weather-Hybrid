"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/glass/GlassCard";
import { WeatherListenButton } from "@/components/settings/WeatherListenButton";
import { stopVoiceOutput } from "@/lib/ai/advisor-voice";
import { getAllDistricts } from "@/lib/districts";
import { sortByDistance } from "@/lib/geo/distance";
import { getDictionary, useTranslation } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n/types";
import { buildDistrictContent } from "@/lib/seo/district-content";
import { extractReadableCardText } from "@/lib/voice/dom-narration";
import { usePreferencesStore } from "@/stores/preferencesStore";
import type { District } from "@/types/weather";

const NEARBY_COUNT = 6;

function nearbyDistricts(district: District): District[] {
  const others = getAllDistricts().filter((item) => item.slug !== district.slug);
  return sortByDistance(others.map((item) => ({ ...item, ...item.coordinates })), {
    lat: district.coordinates.lat,
    lon: district.coordinates.lon,
  }).slice(0, NEARBY_COUNT);
}

/** SEO-first collapsible district reference.
 *
 *  Uses a native server-rendered `<details>` element so 100% of the district
 *  prose, FAQ answers, and nearby district internal links ship in the initial
 *  HTML with zero `sr-only` or hidden-text tricks (full mobile-first indexing
 *  weight). When opened by a human visitor, the `<details>` body renders as a
 *  centered frosted-glass sheet overlay so it never pushes the page downward,
 *  and closes on clicking outside or pressing Escape. */
export function DistrictReference({
  district,
  locale,
}: {
  district: District;
  locale?: SupportedLocale;
}) {
  const { dict: clientDict, uiLanguage } = useTranslation();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [modalSpokenText, setModalSpokenText] = useState<string | null>(null);
  const activeLocale = locale ?? uiLanguage;
  const dict = locale ? getDictionary(locale) : clientDict;
  const content = buildDistrictContent(district, activeLocale);
  const nearby = nearbyDistricts(district);
  const title = dict.districtRef.aboutTitle.replace("{district}", district.name);

  const syncModalState = (open: boolean) => {
    if (wasOpenRef.current && !open) {
      stopVoiceOutput();
    }
    wasOpenRef.current = open;
    setIsOpen(open);
    if (typeof window === "undefined") return;
    document.documentElement.dataset.districtModalOpen = open ? "1" : "0";
    window.dispatchEvent(new CustomEvent("uw:district-modal-open", { detail: open }));
  };

  const closeDetails = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    syncModalState(false);
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setModalSpokenText(null);
      return;
    }
    setModalSpokenText(extractReadableCardText(bodyRef.current, title));
  }, [activeLocale, district.slug, isOpen, title]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        syncModalState(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      syncModalState(false);
    };
  }, []);

  return (
    <section className="mt-6">
      <details
        ref={detailsRef}
        className="group"
        onToggle={() => {
          syncModalState(Boolean(detailsRef.current?.open));
        }}
      >
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Panel className="flex min-h-[56px] items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/[0.08] motion-reduce:transition-none">
            <h2 className="text-[16px] font-semibold text-white">{title}</h2>
            <span className="flex shrink-0 items-center gap-2.5 text-[13px] text-white/70">
              <span className="hidden sm:inline">{dict.districtRef.summaryHint}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </span>
          </Panel>
        </summary>

        {/* Renders as a full-viewport centered glass sheet when open (outside Panel's backdrop-filter) */}
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDetails();
            }
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <Panel className="flex max-h-[82dvh] w-full max-w-[600px] flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
              <p className="text-[16px] font-semibold text-white">{title}</p>
              <div className="flex shrink-0 items-center gap-2">
                <WeatherListenButton
                  compact
                  tileIdOverride="about-district"
                  spokenTextOverride={isOpen ? modalSpokenText : null}
                  getLiveSpokenText={() => extractReadableCardText(bodyRef.current, title)}
                  autoNarrateOnSheetChange={isOpen}
                  testId="about-district-listen"
                />
                <button
                  type="button"
                  aria-label={dict.common.close}
                  onClick={closeDetails}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div ref={bodyRef} className="space-y-5 overflow-y-auto px-5 pt-2 pb-5">
              <p className="text-[14px] leading-relaxed text-white/80">{content.intro}</p>

              <div>
                <h3 className="text-[15px] font-semibold text-white">
                  {dict.districtRef.rainySeasonsTitle.replace("{district}", district.name)}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">{content.seasons}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">{content.farming}</p>
              </div>

              {content.hazards && (
                <div>
                  <h3 className="text-[15px] font-semibold text-white">
                    {dict.districtRef.hazardsTitle.replace("{district}", district.name)}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
                    {content.hazards}
                  </p>
                </div>
              )}

              {content.lake && (
                <p className="text-[14px] leading-relaxed text-white/75">{content.lake}</p>
              )}

              <div>
                <h3 className="text-[15px] font-semibold text-white">
                  {dict.districtRef.commonQuestionsTitle}
                </h3>
                <dl className="mt-2.5 space-y-3">
                  {content.faq.map((item) => (
                    <div key={item.question}>
                      <dt className="text-[14px] font-medium text-white/92">{item.question}</dt>
                      <dd className="mt-1 text-[13px] leading-relaxed text-white/70">
                        {item.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div data-no-narrate>
                <h3 className="text-[15px] font-semibold text-white">
                  {dict.districtRef.nearbyDistrictsTitle}
                </h3>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {nearby.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/district/${item.slug}`}
                        onClick={() => {
                          usePreferencesStore.getState().selectDistrict(item.slug);
                          closeDetails();
                        }}
                        className="inline-block rounded-full border border-white/[0.14] px-3.5 py-1.5 text-[13px] text-white/85 transition-colors hover:border-white/30 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        </div>
      </details>
    </section>
  );
}
