"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

/** A plain section of sheet content, separated from the next by a thin
    divider rather than its own bordered/backed card. Sheets never nest a
    card inside a sheet, text just sits directly on the sheet's
    translucent glass with a rule between sections, so this is the shared
    primitive every detail-sheet body should use instead of reaching for
    `GlassPanel` (which is for standalone tiles sitting on the page
    backdrop, a different visual context). */
export function SheetSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  return (
    <div className={`pt-3 first:pt-0 ${className}`}>
      {label && (
        <p
          className={
            isLuganda
              ? "text-[13.5px] font-semibold text-white/85"
              : "text-[13.5px] font-semibold text-white/85"
          }
        >
          {label}
        </p>
      )}
      <div className={label ? "mt-1.5" : ""}>{children}</div>
    </div>
  );
}
