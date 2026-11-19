"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { lakeHref, type LakeConfig } from "@/lib/marine/lake-conditions";
import { useTranslation } from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferencesStore";

export function LakeShorelinePicker({
  config,
  activeSlug,
}: {
  config: LakeConfig;
  activeSlug: string;
}) {
  const { dict } = useTranslation();
  const router = useRouter();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);

  const selectShore = useCallback(
    (slug: string) => {
      selectDistrict(slug);
      router.replace(lakeHref(config.key, slug), { scroll: false });
    },
    [router, config.key, selectDistrict],
  );

  return (
    <div>
      <p className="text-[13.5px] font-semibold text-white/85">
        {dict.marine.shorelineDistricts}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {config.shorelineDistricts.map((shore) => {
          const active = activeSlug === shore.slug;
          return (
            <button
              key={shore.slug}
              type="button"
              onClick={() => selectShore(shore.slug)}
              className={`rounded-full border px-3 py-1.5 text-[14px] transition ${
                active
                  ? "border-white/30 bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md"
                  : "border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10"
              }`}
            >
              {shore.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
