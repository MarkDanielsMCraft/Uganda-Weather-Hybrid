import type { AlertSeverity } from "@/types/weather";

export const ALERT_SEVERITY_STYLES: Record<
  AlertSeverity,
  { label: string; border: string; accent: string; bg: string }
> = {
  advisory: {
    label: "Alert",
    border: "border-caution/30",
    accent: "text-caution",
    bg: "bg-[rgba(50,38,18,0.55)]",
  },
  watch: {
    label: "Caution",
    border: "border-caution/30",
    accent: "text-caution",
    bg: "bg-[rgba(50,38,18,0.55)]",
  },
  warning: {
    label: "Warning",
    border: "border-[#E07A5F]/35",
    accent: "text-[#ffb09a]",
    bg: "bg-[rgba(55,24,20,0.58)]",
  },
  extreme: {
    label: "Extreme",
    border: "border-[#ff6b6b]/40",
    accent: "text-[#ff8a8a]",
    bg: "bg-[rgba(60,18,18,0.62)]",
  },
};
