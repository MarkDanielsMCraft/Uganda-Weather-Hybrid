"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function ModulePageHeader({
  eyebrow,
  placeName,
  subtitle,
  lead,
  align = "center",
  linkPlace = true,
}: {
  eyebrow: string;
  placeName: string;
  subtitle?: string;
  lead?: string;
  align?: "center" | "left";
  linkPlace?: boolean;
}) {
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const alignClass = align === "left" ? "text-left" : "text-center lg:text-left";

  return (
    <div className={alignClass}>
      <p
        className={
          isLuganda
            ? "text-on-sky text-[13px] font-medium text-white/92"
            : "text-on-sky text-[13px] font-medium uppercase tracking-[0.14rem] text-white/92"
        }
      >
        {eyebrow}
      </p>
      <h1 className="text-on-sky-strong mt-1 text-[32px] font-semibold tracking-[-0.03rem] text-white sm:text-[38px]">
        {linkPlace ? (
          <Link href="/search" className="hover:underline underline-offset-2">
            {placeName}
          </Link>
        ) : (
          placeName
        )}
      </h1>
      {subtitle && <p className="text-on-sky mt-1 text-[15px] font-medium text-white/90">{subtitle}</p>}
      {lead && <p className="text-on-sky mt-1 text-[17px] font-medium text-white/90">{lead}</p>}
    </div>
  );
}

export const modulePageShellClassName = "space-y-4 pb-4 lg:mx-auto lg:max-w-3xl lg:px-10 lg:py-4";
