"use client";

import type { AriaRole, CSSProperties, ReactNode, Ref } from "react";
import { useTranslation } from "@/lib/i18n";

export function Panel({
  children,
  className = "",
  clip = true,
  role,
  style,
  ref,
}: {
  children: ReactNode;
  className?: string;
  /** When false, content is not clipped (use for scroll strips that extend below a min-height). */
  clip?: boolean;
  role?: AriaRole;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role={role}
      className={`${clip ? "overflow-hidden" : "overflow-visible"} rounded-[22px] border border-white/[0.14] bg-[rgba(14,20,34,0.64)] shadow-[0_8px_32px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-[180%] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function WidgetPanel({
  children,
  className = "",
  style,
  clip = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  clip?: boolean;
}) {
  return (
    <Panel
      className={`flex h-full min-h-[148px] flex-col px-4 py-4 ${className}`}
      style={style}
      clip={clip}
    >
      {children}
    </Panel>
  );
}

export function PanelHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  return (
    <div className="mb-3">
      <p
        className={
          isLuganda
            ? "text-[13px] font-semibold leading-snug text-white/75"
            : "text-[13px] font-semibold leading-snug text-white/75"
        }
      >
        {title}
      </p>
      {subtitle && <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/85">{subtitle}</p>}
    </div>
  );
}

export const GlassCard = Panel;
export const GlassPanel = Panel;
export const WidgetCard = WidgetPanel;
export function SectionHeader({ label }: { icon?: ReactNode; label: string }) {
  return <PanelHeading title={label} />;
}
