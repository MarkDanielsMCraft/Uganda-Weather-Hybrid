"use client";

import Link from "next/link";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/lib/i18n";

export function LiteHeaderButton({
  testId = "header-lite-toggle",
}: {
  testId?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const setLiteModePreference = usePreferencesStore((s) => s.setLiteModePreference);

  const liteHref = `/lite?district=${encodeURIComponent(districtSlug || "kampala")}&lang=${uiLanguage}`;

  return (
    <Link
      href={liteHref}
      onClick={() => setLiteModePreference(true)}
      data-testid={testId}
      aria-label={dict.settings.liteMode}
      title={dict.settings.liteMode}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 px-2.5 text-[12px] font-semibold tracking-wide text-white/90 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.95]"
    >
      <span>Lite</span>
    </Link>
  );
}
