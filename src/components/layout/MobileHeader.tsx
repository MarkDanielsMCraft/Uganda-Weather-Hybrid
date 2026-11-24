"use client";

import Link from "next/link";
import { WeatherGlyph } from "@/components/brand/BrandMark";
import { getDistrictBySlug } from "@/lib/districts";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useScrollCollapse } from "@/components/layout/ScrollCollapseContext";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { useAppReady } from "@/hooks/useAppReady";
import { LanguageDropdown } from "@/components/settings/LanguageDropdown";
import { LiteHeaderButton } from "@/components/settings/LiteHeaderButton";
import { WeatherListenButton } from "@/components/settings/WeatherListenButton";
import { localizeDistrictName, useTranslation } from "@/lib/i18n";
import { formatConditionLg } from "@/lib/weather/copy-lg";

export function MobileHeader() {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const activePlace = usePreferencesStore((state) => state.activePlace);
  const district = getDistrictBySlug(districtSlug);
  const ready = useAppReady();
  const { data } = useWeatherBundle(districtSlug, ready, activePlace);
  const temp = data?.data?.temperature?.celsius;
  const condition = data?.data?.condition?.text;
  const isDay = data?.data?.isDay ?? true;

  const displayName = localizeDistrictName(
    (activePlace && (dict.places.items[activePlace.key]?.name ?? activePlace.name)) ??
      district?.name ??
      dict.places.title,
    dict,
  );
  const conditionText = condition ? (isLuganda ? formatConditionLg(condition, isDay) : condition) : dict.common.live;
  const { progress } = useScrollCollapse();

  // Glass backdrop smoothly fades in when scrolled past top
  const headerBg =
    progress > 0
      ? `rgba(18, 16, 26, ${(progress * 0.82).toFixed(2)})`
      : "transparent";
  const borderColor =
    progress > 0
      ? `rgba(255, 255, 255, ${(progress * 0.12).toFixed(2)})`
      : "transparent";

  return (
    <header
      className={`sticky top-0 z-30 -mx-4 md:-mx-6 mb-2 flex items-center justify-between gap-2 px-4 md:px-6 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top,0px))] transition-[background-color,border-color] duration-150 lg:hidden ${
        progress > 0 ? "backdrop-blur-xl" : ""
      }`}
      style={{
        backgroundColor: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/"
          aria-label={dict.common.goToHomeAria}
          // On narrow phones the logo steps aside once the compact title shows,
          // so the place name and temperature are not cut short.
          className={`flex shrink-0 items-center ${progress > 0.6 ? "max-[379px]:hidden" : ""}`}
        >
          <WeatherGlyph size={28} />
        </Link>
        <LanguageDropdown compact align="left" testId="mobile-language-toggle" />
        <WeatherListenButton compact testId="mobile-listen-toggle" />
      </div>

      {/* Compact collapsed title & temperature fading in with GPU translate3d */}
      <div
        className="pointer-events-none flex min-w-0 flex-1 flex-col items-center justify-center px-1 text-center transition-all duration-150"
        style={{
          opacity: progress,
          transform: `translate3d(0, ${((1 - progress) * 6).toFixed(1)}px, 0)`,
        }}
        aria-hidden={progress === 0}
      >
        <p className="w-full truncate text-[14px] font-semibold text-white">
          {displayName}
        </p>
        {temp != null && (
          <p className="w-full truncate text-[11px] font-medium text-white/70">
            {temp}°
            <span className="max-[379px]:hidden"> · {conditionText}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <LiteHeaderButton testId="mobile-lite-toggle" />
        <Link
          href="/search"
          // Screen readers must hear the visible place name first, then the action.
          aria-label={progress > 0.6 ? dict.common.search : `${displayName}, ${dict.common.search}`}
          className="flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/10 px-2.5 text-[12.5px] text-white/90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {progress > 0.6 ? (
            <svg
              className="h-3.5 w-3.5 text-white/80"
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
          ) : (
            <span className="max-w-[92px] truncate">{displayName}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
