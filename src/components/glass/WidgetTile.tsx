"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { WidgetPanel } from "@/components/glass/GlassCard";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { themeTileStyle } from "@/lib/design/theme-visuals";
import { useTranslation } from "@/lib/i18n";
import type { WeatherTheme } from "@/types/weather";

function WidgetPanelLike({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-[22px] border border-white/[0.14] bg-[rgba(14,20,34,0.64)] px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-[180%] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function WidgetTile({
  title,
  children,
  footer,
  className = "",
  theme,
  detail,
  onExpand,
}: {
  title: string;
  children: ReactNode;
  footer?: string;
  className?: string;
  /** Tints the tile toward the current weather condition's sky colour
      (same accent TopBar's city chips use) instead of a flat dark panel
      that looks identical on a sunny day and in a storm. Layered over a
      darkened base rather than replacing it, so white text keeps its
      contrast. */
  theme?: WeatherTheme;
  /** Longer plain-language explanation, shown in a popover on click, so a
      tile can expand into a paragraph or two of context instead of
      stopping at a single footer line, without leaving the page. Omit to
      leave the tile non-interactive. */
  detail?: ReactNode;
  /** Fires the first time this tile opens (not on every open, not on
      close) — for tiles like Air Quality that lazily fetch extra detail
      only once someone actually looks, instead of fetching it for every
      tile on every page load whether or not the modal is ever opened. */
  onExpand?: () => void;
}) {
  const tileId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(false);
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const { sheet, openSheet, closeSheet } = useDetailSheet();
  const isOpen = sheet?.tileId === tileId;

  const accent = theme ? themeTileStyle(theme).accent : null;
  const style = accent
    ? {
        background: `radial-gradient(ellipse at bottom right, ${accent}28 0%, ${accent}0d 50%, transparent 75%), rgba(14,20,34,0.64)`,
      }
    : undefined;

  // Keeps the open sheet's content in sync when `detail` changes after it
  // was opened — e.g. Air Quality's lazy pollutant fetch resolving after
  // the sheet is already showing the tile's placeholder detail view.
  useEffect(() => {
    if (!isOpen) return;
    openSheet({ tileId, title, anchorEl: buttonRef.current, content: detail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, title, isOpen]);

  const footerClass = "mt-auto pt-3 text-[13.5px] font-normal leading-snug text-white/75";

  const header = (
    <div className="flex items-center justify-between gap-2">
      <p
        className={
          isLuganda
            ? "min-w-0 text-[13px] font-semibold leading-snug text-white/75"
            : "min-w-0 text-[13px] font-semibold leading-snug text-white/75"
        }
      >
        {title}
      </p>
      {detail && (
        <span
          aria-hidden="true"
          className={`shrink-0 text-[11px] text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      )}
    </div>
  );

  function handleClick() {
    if (isOpen) {
      closeSheet();
      return;
    }
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      onExpand?.();
    }
    openSheet({ tileId, title, anchorEl: buttonRef.current, content: detail });
  }

  return (
    <WidgetPanel className={`relative ${className}`} style={style}>
      {detail ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          aria-expanded={isOpen}
          className="flex flex-1 flex-col text-left"
        >
          {header}
          <div className="mt-2 flex flex-1 flex-col">{children}</div>
          {footer && <p className={footerClass}>{footer}</p>}
        </button>
      ) : (
        <>
          {header}
          <div className="mt-2 flex flex-1 flex-col">{children}</div>
          {footer && <p className={footerClass}>{footer}</p>}
        </>
      )}
    </WidgetPanel>
  );
}

export function ScaleBar({
  value,
  max = 100,
  colors = "from-[#1B8A7A] via-caution to-[#E07A5F]",
}: {
  value: number;
  max?: number;
  colors?: string;
}) {
  const position = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="relative mt-3 h-1 w-full rounded-full bg-white/20">
      <div className={`absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r ${colors}`} />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
        style={{ left: `${position}%` }}
      />
    </div>
  );
}

export { WidgetPanelLike };
