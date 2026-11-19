"use client";

import Link from "next/link";
import { WeatherGlyph } from "@/components/brand/BrandMark";
import { getDistrictBySlug } from "@/lib/districts";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useScrollCollapse } from "@/components/layout/ScrollCollapseContext";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { useAppReady } from "@/hooks/useAppReady";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { localizeDistrictName, useTranslation } from "@/lib/i18n";
import { formatConditionLg } from "@/lib/weather/copy-lg";

export function MobileHeader() {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const activePlace = usePreferencesStore((state) => state.activePlace);
  const district = getDistrictBySlug(districtSlug);
  const { refresh, isRefreshing } = useRefreshWeather();
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

  const { isInstalled, triggerInstall } = useInstallPrompt();

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
      className="sticky top-0 z-30 -mx-4 md:-mx-6 mb-2 flex items-center justify-between gap-2 px-4 md:px-6 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top,0px))] backdrop-blur-xl transition-[background-color,border-color] duration-150 lg:hidden"
      style={{
        backgroundColor: headerBg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="flex shrink-0 items-center">
        <Link
          href="/"
          aria-label={dict.common.goToHomeAria}
          className="flex shrink-0 items-center"
        >
          <WeatherGlyph size={28} />
        </Link>
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
            {temp}° · {conditionText}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isInstalled && (
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green/65 text-white shadow-[0_6px_18px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.95]"
            title={dict.common.downloadApp}
            aria-label={dict.common.downloadApp}
          >
            <svg
              className="h-3.5 w-3.5 text-white"
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
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={isRefreshing}
          aria-label={dict.common.refreshWeather}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[14px] text-white/80 disabled:opacity-50"
        >
          {isRefreshing ? "…" : "↻"}
        </button>
        <Link
          href="/search"
          aria-label={dict.common.search}
          className="flex h-8 items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 text-[13px] text-white/85 transition-all duration-150"
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
            <span className="max-w-[120px] truncate">{displayName}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
