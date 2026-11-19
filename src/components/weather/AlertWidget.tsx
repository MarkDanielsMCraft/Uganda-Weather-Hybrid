"use client";

import { AlertsDetailContent } from "@/components/alerts/AlertsDetailContent";
import { WidgetTile } from "@/components/glass/WidgetTile";
import { getDistrictBySlug } from "@/lib/districts";
import { useActiveAlerts } from "@/hooks/useActiveAlerts";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useTranslation } from "@/lib/i18n";
import { localizeAlertForLanguage } from "@/lib/weather/copy-lg";

export function AlertWidget() {
  const { dict, uiLanguage } = useTranslation();
  const { alerts } = useActiveAlerts();
  const { alertsDistrictSlug } = useAppLocation();
  const rawAlert = alerts[0];
  if (!rawAlert) return null;

  const alert = localizeAlertForLanguage(rawAlert, uiLanguage, dict.alerts.demo);
  const hazards = getDistrictBySlug(alertsDistrictSlug)?.hazards ?? [];
  const title =
    uiLanguage === "lg"
      ? (dict.alerts.severityLabels[alert.severity] ?? dict.alerts.severeWeatherAlert)
      : alert.severity === "warning" || alert.severity === "extreme"
        ? "Warning"
        : alert.severity === "watch"
          ? "Caution"
          : "Alert";

  const tapGuidance =
    alerts.length > 1
      ? dict.alerts.tapMoreDetails.replace("{count}", String(alerts.length))
      : dict.alerts.tapFullGuidance;

  return (
    <WidgetTile
      title={title}
      className="min-h-[176px]"
      detail={
        <AlertsDetailContent
          alerts={alerts}
          districtSlug={alertsDistrictSlug}
          hazards={hazards}
        />
      }
    >
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <p className="text-[20px] font-semibold leading-snug text-white">{alert.title}</p>
          <p className="mt-1.5 line-clamp-3 text-[14px] font-normal leading-snug text-white/80">
            {alert.description}
          </p>
        </div>
        <p className="mt-3 text-[13.5px] font-normal text-white/75">
          {tapGuidance}
        </p>
      </div>
    </WidgetTile>
  );
}
