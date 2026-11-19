"use client";

import Link from "next/link";
import { WeatherGlyph } from "@/components/brand/BrandMark";
import { GlassPanel } from "@/components/glass/GlassCard";
import { AppFooter } from "@/components/layout/AppFooter";
import { TopBar } from "@/components/layout/TopBar";
import { getPopularDistricts } from "@/lib/districts";
import { localizeDistrictName, useTranslation } from "@/lib/i18n";

export function NotFoundView() {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const majorDistricts = getPopularDistricts(8);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#12101a]">
      {/* Full-screen Uganda map backdrop matching the native launch screen */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/uganda-osm-map.png"
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="sync"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#12101a]/55" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <TopBar />

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10 md:px-6">
          <GlassPanel className="text-on-sky w-full px-6 py-8 text-center sm:px-8 sm:py-10">
            <div className="flex justify-center">
              <WeatherGlyph
                size={56}
                className="drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
              />
            </div>

            <h1 className="mt-4 text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
              {dict.notFoundPage.title}
            </h1>

            <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-white/80 sm:text-[15px]">
              {dict.notFoundPage.body}
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/30 bg-white/[0.20] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-white/[0.28] active:scale-[0.99] sm:w-auto"
              >
                <span>{dict.notFoundPage.homeButton}</span>
              </Link>

              <Link
                href="/search"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/18 bg-white/[0.08] px-5 py-2.5 text-[14px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl transition hover:border-white/28 hover:bg-white/[0.14] hover:text-white active:scale-[0.99] sm:w-auto"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-white/80"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{dict.notFoundPage.searchButton}</span>
              </Link>
            </div>

            <div className="mt-7 pt-5">
              <p
                className={
                  isLuganda
                    ? "text-[13px] font-semibold text-white/70"
                    : "text-[11px] font-semibold uppercase tracking-[0.12rem] text-white/60"
                }
              >
                {dict.notFoundPage.popularDistrictsTitle}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {majorDistricts.map((district) => (
                  <Link
                    key={district.slug}
                    href={`/district/${district.slug}`}
                    className="rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[13px] font-medium text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:border-white/30 hover:bg-white/[0.16] hover:text-white"
                  >
                    {localizeDistrictName(district.name, dict)}
                  </Link>
                ))}
              </div>
            </div>
          </GlassPanel>
        </main>

        <AppFooter />
      </div>
    </div>
  );
}
