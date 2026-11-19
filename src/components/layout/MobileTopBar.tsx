"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { moduleTitle } from "@/lib/navigation/modules";
import { useRefreshWeather } from "@/hooks/useRefreshWeather";
import { useTranslation } from "@/lib/i18n";

export function MobileTopBar() {
  const pathname = usePathname();
  const { refresh, isRefreshing } = useRefreshWeather();
  const { dict } = useTranslation();

  if (pathname === "/" || pathname.startsWith("/district/")) return null;

  const localizedTitle =
    dict.navigation.pageTitles[pathname] ??
    (pathname === "/" || moduleTitle(pathname) !== "Back"
      ? moduleTitle(pathname)
      : dict.common.back);

  return (
    <div className="mb-4 flex items-center gap-3 lg:hidden">
      <Link
        href="/"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[18px] text-white/90"
        aria-label={dict.common.backToNow}
      >
        ‹
      </Link>
      <p className="min-w-0 flex-1 truncate text-[17px] font-medium text-white">
        {localizedTitle}
      </p>
      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
        disabled={isRefreshing}
        aria-label={dict.common.refreshWeather}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[15px] text-white/80 transition hover:border-white/25 disabled:opacity-50"
      >
        {isRefreshing ? "…" : "↻"}
      </button>
    </div>
  );
}
