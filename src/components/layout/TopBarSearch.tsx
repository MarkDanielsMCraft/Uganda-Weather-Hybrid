"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch } from "@/components/icons/nav-icons";
import { getAllDistricts } from "@/lib/districts";
import {
  cachePlaceSearchHits,
  searchOfflineLocations,
} from "@/lib/places/offline-place-cache";
import { useDistrictNavigation } from "@/hooks/useDistrictNavigation";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { formatDistrictPhrase, localizeDistrictName, useTranslation } from "@/lib/i18n";
import type { LocationSearchHit } from "@/lib/places/types";

function formatPlaceSubtitle(
  hit: Extract<LocationSearchHit, { kind: "place" }>,
  approximateLabel: string,
) {
  const parts = [hit.label];
  if (hit.approximate) parts.push(approximateLabel);
  return parts.join(" · ");
}

function formatDistrictRegionSubtitle(
  region: string,
  regions: Record<string, string>,
  template: string,
) {
  const localizedRegion = regions[region.trim().toLowerCase()] ?? region;
  return template.replace("{region}", localizedRegion);
}

/** Any of the 152 districts or local places can still be reached through
    search — the top bar chips are a fast-access shortlist of major
    cities only, not the full extent of what's navigable. */
export function SearchResultRow({
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
      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-white/8"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] text-white">{title}</p>
        <p className={`truncate text-[12px] ${uiLanguage === "lg" ? "" : "capitalize "}text-white/45`}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

export function TopBarSearch() {
  const { dict, uiLanguage } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<LocationSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const recentDistricts = usePreferencesStore((s) => s.recentDistricts);
  const recentPlaces = usePreferencesStore((s) => s.recentPlaces);
  const clearRecents = usePreferencesStore((s) => s.clearRecents);
  const { selectDistrict, selectPlace } = useDistrictNavigation();

  const recentDistrictList = useMemo(
    () =>
      recentDistricts
        .filter((slug) => slug !== districtSlug)
        .map((slug) => getAllDistricts().find((d) => d.slug === slug))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .slice(0, 4),
    [recentDistricts, districtSlug],
  );

  const isSearching = query.trim().length >= 2;
  const showDropdown = focused && (isSearching || recentDistrictList.length > 0 || recentPlaces.length > 0);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isSearching) {
      setSearchHits([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      const trimmed = query.trim();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setSearchHits(searchOfflineLocations(trimmed));
        setSearching(false);
        return;
      }
      try {
        const response = await fetch(
          `/api/v1/locations/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSearchHits(searchOfflineLocations(trimmed));
          return;
        }
        const payload = await response.json();
        const remoteResults = payload.data?.results ?? [];
        cachePlaceSearchHits(remoteResults);
        setSearchHits(remoteResults);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSearchHits(searchOfflineLocations(trimmed));
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
  }, [isSearching, query]);

  function closeDropdown() {
    setQuery("");
    setFocused(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`relative block ${uiLanguage === "lg" ? "w-[272px]" : "w-[240px]"}`}>
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          aria-label={dict.common.searchPlaceholder}
          placeholder={uiLanguage === "lg" ? dict.common.searchPlaceholder : "Search districts or villages"}
          className="w-full rounded-xl border border-white/15 bg-white/10 py-2 pl-9 pr-3 text-[15px] text-white placeholder:text-white/60 outline-none focus:border-white/30"
        />
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 max-h-[70vh] w-[min(340px,calc(100vw-2rem))] overflow-y-auto rounded-[18px] border border-white/[0.14] bg-[rgba(14,20,34,0.97)] p-[6px] shadow-[0_18px_40px_-6px_rgba(0,0,0,0.75),0_4px_12px_-2px_rgba(0,0,0,0.45)] backdrop-blur-[32px] backdrop-saturate-[200%]">
          {isSearching ? (
            searching ? (
              <p className="px-4 py-4 text-[13px] text-white/75">
                {uiLanguage === "lg" ? dict.common.loading : "Searching"}
              </p>
            ) : searchHits.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-white/75">{dict.common.noPlacesFound}</p>
            ) : (
              searchHits.map((hit) =>
                hit.kind === "district" ? (
                  <SearchResultRow
                    key={`district-${hit.slug}`}
                    title={hit.name}
                    subtitle={formatDistrictRegionSubtitle(
                      hit.region,
                      dict.common.regions,
                      dict.common.districtOfRegion,
                    )}
                    onSelect={() => {
                      selectDistrict(hit.slug);
                      closeDropdown();
                    }}
                  />
                ) : (
                  (() => {
                    const localizedPlace = dict.places.items[hit.key];
                    return (
                      <SearchResultRow
                        key={`place-${hit.key}`}
                        title={localizedPlace?.name ?? hit.name}
                        subtitle={formatPlaceSubtitle(
                          { ...hit, label: localizedPlace?.label ?? hit.label },
                          dict.search.approximateLocation,
                        )}
                        onSelect={() => {
                          selectPlace({
                            key: hit.key,
                            name: hit.name,
                            label: hit.label,
                            lat: hit.lat,
                            lon: hit.lon,
                            parentDistrictSlug: hit.parentDistrictSlug,
                            region: hit.region,
                          });
                          closeDropdown();
                        }}
                      />
                    );
                  })()
                ),
              )
            )
          ) : (
            <>
              {(recentDistrictList.length > 0 || recentPlaces.length > 0) && (
                <div className="flex items-center justify-between px-3 pt-2">
                  <p className="text-[12px] font-semibold text-white/55">
                    {dict.common.recent}
                  </p>
                  <button
                    type="button"
                    onClick={clearRecents}
                    className="text-[12px] text-white/75 underline-offset-2 hover:text-white hover:underline"
                  >
                    {dict.common.clear}
                  </button>
                </div>
              )}
              {recentDistrictList.length > 0 && (
                <div className="p-1">
                  <p className="px-3 pt-2 text-[12px] font-semibold text-white/55">
                    {dict.common.recentDistricts}
                  </p>
                  {recentDistrictList.map((district) => (
                    <SearchResultRow
                      key={district.slug}
                      title={district.name}
                      subtitle={formatDistrictRegionSubtitle(
                        district.region,
                        dict.common.regions,
                        dict.common.districtOfRegion,
                      )}
                      onSelect={() => {
                        selectDistrict(district.slug);
                        closeDropdown();
                      }}
                    />
                  ))}
                </div>
              )}
              {recentPlaces.length > 0 && (
                <div className="p-1">
                  <p className="px-3 pt-2 text-[12px] font-semibold text-white/55">
                    {dict.common.recentPlaces}
                  </p>
                  {recentPlaces.slice(0, 4).map((place) => {
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
                      <SearchResultRow
                        key={place.key}
                        title={localizeDistrictName(rawTitle, dict)}
                        subtitle={subtitle}
                        onSelect={() => {
                          selectPlace(place);
                          closeDropdown();
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
