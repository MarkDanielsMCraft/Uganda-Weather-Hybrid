"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DesktopDashboard } from "@/components/weather/DesktopDashboard";
import { MobileHome } from "@/components/weather/MobileHome";
import { WeatherPageSkeleton } from "@/components/weather/WeatherPageSkeleton";
import { getDistrictBySlug } from "@/lib/districts";
import { useAppReady } from "@/hooks/useAppReady";
import { useModuleWeather } from "@/hooks/useModuleWeather";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { useTranslation } from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** `reference` is the district's About card. It is passed in rather than
    rendered after this component so it lands above the data source line
    inside the layout, instead of after it where the page already looks
    finished. It stays server rendered: this component is a client one, but a
    server node handed in as a prop is still rendered on the server. */
export function DistrictWeatherPage({
  slug,
  reference,
}: {
  slug: string;
  reference?: ReactNode;
}) {
  const ready = useAppReady();
  const { dict, uiLanguage } = useTranslation();
  const isDesktop = useIsLgUp();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);
  const { weather, meta, waiting, isError, isFetching, displaySubtitle } = useModuleWeather(slug);
  const { refresh, isRefreshing } = useRefreshWeather();
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    if (!ready || !getDistrictBySlug(slug)) return;
    selectDistrict(slug);
    const scrollEl = document.querySelector<HTMLElement>(".main-scroll");
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [ready, slug, selectDistrict]);

  useEffect(() => {
    if (!waiting) {
      setSlowLoad(false);
      return;
    }

    const timer = window.setTimeout(() => setSlowLoad(true), 4000);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const district = getDistrictBySlug(slug);
  const districtName = district?.name;

  if (waiting) {
    return (
      <div className="space-y-3">
        <WeatherPageSkeleton districtName={districtName} />
        {slowLoad && (
          <p className="px-1 text-center text-[14px] text-white/45">
            {uiLanguage === "lg" ? (
              <>
                {dict.common.stillLoadingHintLine1} {dict.common.stillLoadingHintLine2}
              </>
            ) : (
              <>
                Still loading weather data. If this persists, hard refresh or run{" "}
                <code className="rounded bg-white/10 px-1">npm run dev:clean</code>.
              </>
            )}
          </p>
        )}
        {reference}
      </div>
    );
  }

  if (isError && !weather) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[17px] text-[#ff8a7a]">{dict.common.couldNotLoadWeather}</p>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={isRefreshing}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[14px] text-white/85 disabled:opacity-50"
        >
          {isRefreshing ? dict.common.retrying : dict.common.retry}
        </button>
        {(isFetching || isRefreshing) && (
          <p className="text-[14px] text-white/45">{dict.common.retrying}</p>
        )}
        {reference}
      </div>
    );
  }

  if (!weather) {
    return (
      <>
        <WeatherPageSkeleton />
        {reference}
      </>
    );
  }

  return isDesktop ? (
    <DesktopDashboard
      weather={weather}
      meta={meta}
      placeSubtitle={displaySubtitle}
      reference={reference}
    />
  ) : (
    <MobileHome
      weather={weather}
      meta={meta}
      placeSubtitle={displaySubtitle}
      reference={reference}
    />
  );
}
