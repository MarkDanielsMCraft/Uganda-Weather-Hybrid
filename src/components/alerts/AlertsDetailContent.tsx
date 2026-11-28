"use client";

import { AlertShareButton } from "@/components/alerts/AlertShareButton";
import { PushAlertsToggle } from "@/components/alerts/PushAlertsToggle";
import { IconAlert } from "@/components/icons/nav-icons";
import { ALERT_SEVERITY_STYLES } from "@/lib/design/alert-styles";
import { useTranslation } from "@/lib/i18n";
import { formatUgandaDateTime } from "@/lib/time/uganda";
import { formatHazardTitleLg, localizeAlertForLanguage } from "@/lib/weather/copy-lg";
import type { WeatherAlert } from "@/types/weather";

/** Full alert content, shared by SevereAlertBanner, AlertWidget, and the
    Alerts tile's sheet through the common detail sheet — alerts used to
    open /alerts on click, which meant the one place on the site carrying
    official warning text was also the one place that still left the page
    on a plain tap. `hazards` (a district's standing hazard profile, not
    tied to any active alert) is optional so the compact SevereAlertBanner
    / AlertWidget uses can keep passing just the alert list. */
export function AlertsDetailContent({
  alerts,
  districtSlug,
  hazards = [],
}: {
  alerts: WeatherAlert[];
  districtSlug: string;
  hazards?: string[];
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";

  return (
    <div className="space-y-5">
      <div data-no-narrate>
        <PushAlertsToggle />
      </div>

      {alerts.length === 0 && (
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-4 text-center">
          <p className="text-[15px] text-white/70">
            {dict.alerts.noActiveDistrict}
          </p>
        </div>
      )}

      {alerts.map((rawAlert) => {
        const alert = localizeAlertForLanguage(rawAlert, uiLanguage, dict.alerts.demo);
        const style = ALERT_SEVERITY_STYLES[alert.severity];
        const severityLabel = dict.alerts.severityLabels[alert.severity] ?? style.label;
        const issued = formatUgandaDateTime(
          alert.issuedAt,
          {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          },
          uiLanguage,
        );
        const expires = alert.expiresAt
          ? formatUgandaDateTime(
              alert.expiresAt,
              {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              },
              uiLanguage,
            )
          : null;

        return (
          <div key={alert.id} className={`rounded-[16px] border p-4 ${style.border} ${style.bg}`}>
            <div className={`flex items-center gap-2 ${style.accent}`}>
              <IconAlert width={15} height={15} />
              <p className={`text-[12px] font-semibold ${isLg ? "" : "uppercase "}tracking-[0.14rem]`}>{severityLabel}</p>
            </div>
            <p className="mt-2 text-[17px] font-medium leading-snug text-white">{alert.title}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/85">{alert.description}</p>
            <div className="mt-3 space-y-1 text-[12.5px] text-white/50">
              {issued && <p>{dict.alerts.issued.replace("{time}", issued)}</p>}
              {expires && <p>{dict.alerts.expires.replace("{time}", expires)}</p>}
            </div>
            <div data-no-narrate className="mt-3">
              <AlertShareButton alert={alert} districtSlug={districtSlug} />
            </div>
          </div>
        );
      })}

      {hazards.length > 0 && (
        <div className="space-y-4 pt-3">
          <h2
            className={
              isLg
                ? "text-[13px] font-semibold text-white/55"
                : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
            }
          >
            {dict.alerts.localHazardContext}
          </h2>
          {hazards.map((hazard) => (
            <div key={hazard}>
              <p className={`text-[15px] font-medium ${isLg ? "" : "capitalize "}text-white`}>
                {isLg ? formatHazardTitleLg(hazard) : hazard}
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">
                {dict.alerts.hazards[hazard] ?? dict.alerts.defaultHazardNote}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
