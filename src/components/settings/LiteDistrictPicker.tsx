"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface LiteDistrictOption {
  slug: string;
  name: string;
}

export function LiteDistrictPicker({
  districts,
  selectedSlug,
  lang,
}: {
  districts: readonly LiteDistrictOption[];
  selectedSlug: string;
  lang: "en" | "lg";
}) {
  const router = useRouter();
  const isLg = lang === "lg";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const selectedDistrict =
    districts.find((d) => d.slug === selectedSlug) ?? districts[0];

  const filteredDistricts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q),
    );
  }, [districts, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (slug: string) => {
    setOpen(false);
    router.push(`/lite?district=${encodeURIComponent(slug)}&lang=${lang}`);
  };

  return (
    <div ref={rootRef} className="relative mb-4">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={isLg ? "Londa disitulikiti" : "Select district"}
        data-testid="lite-district-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-full border border-white/[0.16] bg-[rgba(18,20,34,0.78)] px-4 py-2 text-left text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:border-white/25 hover:bg-[rgba(24,26,42,0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span className="min-w-0 break-words text-left">{selectedDistrict?.name ?? selectedSlug}</span>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className={`h-3 w-3 shrink-0 text-white/70 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={isLg ? "Londa disitulikiti" : "Select district"}
          className="absolute right-0 left-0 z-50 mt-2 rounded-[18px] border border-white/[0.14] bg-[rgba(14,20,34,0.97)] p-2 shadow-[0_18px_40px_-6px_rgba(0,0,0,0.75),0_4px_12px_-2px_rgba(0,0,0,0.45)] backdrop-blur-[32px] backdrop-saturate-[200%]"
        >
          <div className="mb-1.5 px-1">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                isLg ? "Noonya disitulikiti..." : "Search district..."
              }
              aria-label={isLg ? "Noonya disitulikiti" : "Search district"}
              className="min-h-[36px] w-full rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[13px] text-white placeholder:text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            />
          </div>
          <div className="max-h-[224px] overflow-y-auto overscroll-contain pr-0.5">
            {filteredDistricts.length > 0 ? (
              filteredDistricts.map((item) => {
                const active = item.slug === selectedSlug;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => handleSelect(item.slug)}
                    className={`my-[2px] flex min-h-[40px] w-full items-center justify-between gap-2 rounded-full px-3.5 py-1.5 text-left text-[14px] font-medium transition-colors ${
                      active
                        ? "bg-brand-green/65 text-on-brand shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)]"
                        : "text-[#f8fafc] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="min-w-0 break-words">{item.name}</span>
                    {active && (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-3 text-center text-[13px] text-white/60">
                {isLg ? "Tewali disitulikiti efuniddwa." : "No matching district."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
