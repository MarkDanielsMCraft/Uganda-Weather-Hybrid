"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { CityChipsTrack } from "@/components/layout/CityChipsTrack";
import { TopBarSearch } from "@/components/layout/TopBarSearch";
import { UseMyLocationButton } from "@/components/search/UseMyLocationButton";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useTranslation } from "@/lib/i18n";

export function TopBar() {
  const { dict } = useTranslation();
  const { refresh, isRefreshing } = useRefreshWeather();
  const { isInstalled, triggerInstall } = useInstallPrompt();

  return (
    <header className="relative z-20 hidden h-[68px] w-full shrink-0 items-center gap-4 border-b border-white/10 bg-[rgba(26,21,36,0.82)] px-5 backdrop-blur-2xl lg:flex">
      <BrandMark glyphSize={32} />

      <CityChipsTrack />

      <div className="flex shrink-0 items-center gap-2">
        {!isInstalled && (
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green/65 text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.95]"
            title={dict.common.downloadApp}
            aria-label={dict.common.downloadApp}
          >
            <svg
              className="h-4 w-4 text-white"
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

        <UseMyLocationButton
          popover
          className="relative [&_button]:h-9 [&_button]:w-9 [&_button]:justify-center [&_button]:rounded-xl [&_button]:p-0 [&_button>span+span]:hidden"
        />

        <TopBarSearch />

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          aria-label={dict.common.refreshWeather}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[15px] text-white/80 disabled:opacity-50"
        >
          {isRefreshing ? "…" : "↻"}
        </button>
      </div>
    </header>
  );
}
