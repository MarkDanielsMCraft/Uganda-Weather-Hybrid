"use client";

import { useId, useRef } from "react";
import { AlertsDetailContent } from "@/components/alerts/AlertsDetailContent";
import { IconAlert } from "@/components/icons/nav-icons";
import { ALERT_SEVERITY_STYLES } from "@/lib/design/alert-styles";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useActiveAlerts } from "@/hooks/useActiveAlerts";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useTranslation } from "@/lib/i18n";
import { localizeAlertForLanguage } from "@/lib/weather/copy-lg";

const PROMINENT_SEVERITIES = new Set(["extreme", "warning"]);

export function SevereAlertBanner() {
  const { dict, uiLanguage } = useTranslation();
  const tileId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { sheet, openSheet, closeSheet } = useDetailSheet();
  const { alerts } = useActiveAlerts();
  const { alertsDistrictSlug } = useAppLocation();
  const rawAlert = alerts.find((item) => PROMINENT_SEVERITIES.has(item.severity));

  if (!rawAlert) return null;

  const alert = localizeAlertForLanguage(rawAlert, uiLanguage, dict.alerts.demo);
  const prominentAlert = alert;
  const style = ALERT_SEVERITY_STYLES[alert.severity];
  const isOpen = sheet?.tileId === tileId;

  const severityLabel = dict.alerts.severityLabels[alert.severity] ?? style.label;

  function handleClick() {
    if (isOpen) {
      closeSheet();
      return;
    }
    openSheet({
      tileId,
      title: dict.alerts.severeWeatherAlert,
      anchorEl: buttonRef.current,
      content: <AlertsDetailContent alerts={[prominentAlert]} districtSlug={alertsDistrictSlug} />,
    });
  }

  return (
    <div className="mb-1 flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        style={{
          background:
            "radial-gradient(closest-side, rgba(14, 20, 34, 0.56) 0%, rgba(14, 20, 34, 0.28) 60%, rgba(14, 20, 34, 0) 100%)",
        }}
        className="text-on-sky inline-flex max-w-full items-center gap-2 rounded-full border-none px-7 py-2.5 text-left text-[13px] text-white transition hover:opacity-100 active:scale-[0.98]"
      >
        <IconAlert width={14} height={14} className="shrink-0 text-[var(--color-alert-red)]" />
        <span className="shrink-0 font-bold text-[var(--color-alert-red)]">{severityLabel}</span>
        <span aria-hidden="true" className="text-white/45">
          ·
        </span>
        <span className="truncate font-normal text-white/95">{alert.title}</span>
      </button>
    </div>
  );
}
