"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassPanel } from "@/components/glass/GlassCard";
import { IconChevronRight } from "@/components/icons/nav-icons";
import {
  ModulePageHeader,
  modulePageShellClassName,
} from "@/components/layout/ModulePageHeader";
import { UseMyLocationButton } from "@/components/search/UseMyLocationButton";
import { LiteModeToggle } from "@/components/settings/LiteModeToggle";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { getAllDistricts, getDistrictBySlug, getPopularDistricts } from "@/lib/districts";
import type { LocationSearchHit } from "@/lib/places/types";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { formatDistrictPhrase, localizeDistrictName, useTranslation } from "@/lib/i18n";

function placeSubtitle(
  hit: Extract<LocationSearchHit, { kind: "place" }>,
  approximateLabel: string,
) {
  const parts = [hit.label];
  if (hit.approximate) parts.push(approximateLabel);
  return parts.join(" · ");
}

/** A plain button, not a `<Link href>` — `onSelect` already navigates via
    `useDistrictNavigation`'s `router.replace()`, so a real href here
    would fire a SECOND, conflicting navigation to the same target on
    every click (this was a real bug: combining the two silently broke
    normal clicks, since Next's Link and a manual router.replace() to the
    same URL step on each other). TopBar's own search dropdown uses this
    same button-only pattern for the same reason. */
function LocationRow({
  title,
  subtitle,
  onSelect,
}: {
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  const { uiLanguage } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-white/6"
    >
      <div className="min-w-0">
        <p className="truncate text-[17px] text-white">{title}</p>
        <p className={`truncate text-[15px] ${uiLanguage === "lg" ? "" : "capitalize "}text-white/50`}>
          {subtitle}
        </p>
      </div>
      <IconChevronRight className="shrink-0 text-white/35" />
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { uiLanguage } = useTranslation();
  return (
    <p
      className={
        uiLanguage === "lg"
          ? "mb-3 text-[13px] font-semibold text-white/55"
          : "mb-3 text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
      }
    >
      {children}
    </p>
  );
}

export function SearchPageClient() {
  const { dict, uiLanguage } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const { selectDistrict, selectPlace } = useDistrictNavigation();
  const recentDistricts = usePreferencesStore((state) => state.recentDistricts);
  const recentPlaces = usePreferencesStore((state) => state.recentPlaces);
  const clearRecents = usePreferencesStore((state) => state.clearRecents);
  const popular = getPopularDistricts();
  const districtCount = getAllDistricts().length;
  const trimmedQuery = query.trim();

  const recent = useMemo(
    () =>
      recentDistricts
        .map((slug) => getDistrictBySlug(slug))
        .filter((district): district is NonNullable<typeof district> => Boolean(district)),
    [recentDistricts],
  );

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    setSearching(true);
    setSearchError(false);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/v1/locations/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSearchError(true);
          setResults([]);
          return;
        }
        const payload = await response.json();
        setResults(payload.data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSearchError(true);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  const regionLabel = (region: keyof typeof dict.common.regions) =>
    dict.common.districtOfRegion.replace(
      "{region}",
      dict.common.regions[region],
    );

  return (
    <div className={modulePageShellClassName}>
      <ModulePageHeader
        eyebrow={dict.common.search}
        placeName={dict.navigation.places}
        lead={dict.search.districtsLead.replace("{count}", String(districtCount))}
        linkPlace={false}
      />

      <UseMyLocationButton />

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={uiLanguage === "lg" ? dict.common.searchPlaceholder : "Try Kyaziiza, Entebbe, or Gulu"}
        className="w-full rounded-[16px] border border-white/10 bg-white/10 px-4 py-3.5 text-[17px] text-white placeholder:text-white/35 outline-none focus:border-white/25"
        autoComplete="off"
        spellCheck={false}
      />

      {trimmedQuery.length >= 2 && (
        <div>
          {searching ? (
            <p className="px-1 text-[15px] text-white/50">
              {uiLanguage === "lg" ? dict.common.loading : "Searching"}
            </p>
          ) : searchError ? (
            <GlassPanel className="px-4 py-4">
              <p className="text-[15px] text-white/72">{dict.search.searchUnavailable}</p>
            </GlassPanel>
          ) : results.length > 0 ? (
            <GlassPanel>
              {results.map((result) =>
                result.kind === "district" ? (
                  <LocationRow
                    key={`district-${result.slug}`}
                    title={result.name}
                    subtitle={regionLabel(result.region)}
                    onSelect={() => selectDistrict(result.slug)}
                  />
                ) : (
                  (() => {
                    const localizedPlace = dict.places.items[result.key];
                    return (
                      <LocationRow
                        key={`place-${result.key}`}
                        title={localizedPlace?.name ?? result.name}
                        subtitle={placeSubtitle(
                          { ...result, label: localizedPlace?.label ?? result.label },
                          dict.search.approximateLocation,
                        )}
                        onSelect={() =>
                          selectPlace({
                            key: result.key,
                            name: result.name,
                            label: result.label,
                            lat: result.lat,
                            lon: result.lon,
                            parentDistrictSlug: result.parentDistrictSlug,
                            region: result.region,
                          })
                        }
                      />
                    );
                  })()
                ),
              )}
            </GlassPanel>
          ) : (
            <GlassPanel className="px-4 py-4">
              <p className="text-[15px] text-white/72">
                {dict.search.noMatchedPlaces.replace("{query}", trimmedQuery)}
              </p>
            </GlassPanel>
          )}
        </div>
      )}

      {recentPlaces.length > 0 && trimmedQuery.length < 2 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>{dict.common.recentPlaces}</SectionLabel>
            <button
              type="button"
              onClick={clearRecents}
              className="text-[13px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            >
              {dict.common.clear}
            </button>
          </div>
          <GlassPanel>
            {recentPlaces.map((place) => {
              const localizedPlace = dict.places.items[place.key];
              const rawTitle = localizedPlace?.name ?? place.name;
              const rawSubtitle = localizedPlace?.label ?? place.label;
              const subtitle =
                uiLanguage === "lg" && /^near\s+/i.test(rawSubtitle)
                  ? formatDistrictPhrase(
                      dict.common.nearDistrict,
                      rawSubtitle.replace(/^near\s+/i, ""),
                      dict,
                      uiLanguage,
                    )
                  : rawSubtitle;
              return (
                <LocationRow
                  key={place.key}
                  title={localizeDistrictName(rawTitle, dict)}
                  subtitle={subtitle}
                  onSelect={() => selectPlace(place)}
                />
              );
            })}
          </GlassPanel>
        </div>
      )}

      {recent.length > 0 && trimmedQuery.length < 2 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>{dict.common.recentDistricts}</SectionLabel>
            {recentPlaces.length === 0 && (
              <button
                type="button"
                onClick={clearRecents}
                className="text-[13px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
              >
                {dict.common.clear}
              </button>
            )}
          </div>
          <GlassPanel>
            {recent.map((district) => (
              <LocationRow
                key={district.slug}
                title={district.name}
                subtitle={regionLabel(district.region)}
                onSelect={() => selectDistrict(district.slug)}
              />
            ))}
          </GlassPanel>
        </div>
      )}

      {trimmedQuery.length < 2 && (
        <div>
          <SectionLabel>{dict.common.popularDistricts}</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {popular.map((district) => (
              <button
                key={district.slug}
                type="button"
                onClick={() => selectDistrict(district.slug)}
                className="flex items-center justify-between rounded-[22px] border border-white/[0.14] bg-[rgba(28,28,30,0.42)] px-4 py-3.5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:bg-[rgba(28,28,30,0.6)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[17px] text-white">{district.name}</p>
                  <p className={`truncate text-[15px] ${uiLanguage === "lg" ? "" : "capitalize "}text-white/50`}>
                    {regionLabel(district.region)}
                  </p>
                </div>
                <IconChevronRight className="shrink-0 text-white/35" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 lg:hidden">
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
          <LanguageSwitcher />
          <LiteModeToggle />
        </div>
      </div>
    </div>
  );
}
