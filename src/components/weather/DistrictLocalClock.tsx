"use client";

import { useEffect, useState } from "react";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import { formatUgandaClock } from "@/lib/time/uganda";

export function DistrictLocalClock({
  districtName,
  className = "",
  compact = false,
}: {
  /** @deprecated Ignored. Clock always shows live Africa/Kampala time. */
  localTime?: string;
  districtName?: string;
  className?: string;
  compact?: boolean;
}) {
  const { dict, uiLanguage } = useTranslation();
  const [clock, setClock] = useState("");
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(formatUgandaClock(now, true, uiLanguage));
      setDateTime(now.toISOString());
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [uiLanguage]);

  if (!clock) return null;

  if (compact) {
    return (
      <span className={className}>
        <time dateTime={dateTime}>{clock}</time>
      </span>
    );
  }

  return (
    <p className={className}>
      <time dateTime={dateTime} className="font-medium tabular-nums text-white/90">
        {clock}
      </time>
      <span className="text-white/75">
        {districtName
          ? formatDistrictPhrase(dict.common.clockInDistrict, districtName, dict, uiLanguage)
          : ""}
      </span>
    </p>
  );
}
