"use client";

import { useId, useRef } from "react";
import { getWeatherProviderInfo } from "@/lib/weather/source";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { SiteHealthContent } from "@/components/layout/SiteHealthContent";
import { useAppReady } from "@/hooks/useAppReady";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/lib/i18n";

/** Reads the same weather bundle the rest of the app already fetches for
    the current district and surfaces its provider/source as a plain-
    language reliability signal, no separate polling needed since the
    bundle already carries this on every load. Clicking it opens the full
    Site Health sheet with a live connectivity check across every
    provider, through the same shared detail sheet every other tile
    uses. */
export function SystemStatusIndicator() {
  const { dict, uiLanguage } = useTranslation();
  const tileId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { sheet, openSheet, closeSheet } = useDetailSheet();
  const ready = useAppReady();
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const activePlace = usePreferencesStore((state) => state.activePlace);
  const { data, isPending, isError } = useWeatherBundle(districtSlug, ready, activePlace);
  const weather = data?.data;
  const isOpen = sheet?.tileId === tileId;

  function handleClick() {
    if (isOpen) {
      closeSheet();
      return;
    }
    openSheet({
      tileId,
      title: dict.sheets.siteHealth.title,
      anchorEl: buttonRef.current,
      content: <SiteHealthContent weather={weather} />,
    });
  }

  if (!ready || isPending) {
    return (
      <span className="inline-flex items-center">
        {dict.sheets.siteHealth.checkingStatus}
      </span>
    );
  }

  if (isError || !weather) {
    return (
      <button ref={buttonRef} type="button" onClick={handleClick} className="inline-flex items-center hover:text-white/60">
        {dict.sheets.siteHealth.footerButton}
      </button>
    );
  }

  const info = getWeatherProviderInfo(weather.source, uiLanguage);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      title={info.description}
      className="inline-flex items-center underline-offset-2 hover:text-white/60 hover:underline"
    >
      {dict.sheets.siteHealth.footerButton}
    </button>
  );
}
