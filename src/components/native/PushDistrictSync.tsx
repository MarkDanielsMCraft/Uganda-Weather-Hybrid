"use client";

import { useEffect, useRef } from "react";
import { isNativeApp } from "@/lib/native/platform";
import { syncPushDistrict } from "@/lib/native/push";
import { usePreferencesStore } from "@/stores/preferencesStore";

export function PushDistrictSync() {
  const pushAlerts = usePreferencesStore((state) => state.pushAlerts);
  const pushDeviceToken = usePreferencesStore((state) => state.pushDeviceToken);
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const uiLanguage = usePreferencesStore((state) => state.uiLanguage);
  const previousDistrict = useRef(districtSlug);
  const previousLanguage = useRef(uiLanguage);

  useEffect(() => {
    if (!pushAlerts || !pushDeviceToken) {
      previousDistrict.current = districtSlug;
      previousLanguage.current = uiLanguage;
      return;
    }

    if (
      previousDistrict.current === districtSlug &&
      previousLanguage.current === uiLanguage
    ) {
      return;
    }
    previousDistrict.current = districtSlug;
    previousLanguage.current = uiLanguage;

    void (async () => {
      if (!(await isNativeApp())) return;
      await syncPushDistrict(pushDeviceToken, districtSlug, uiLanguage);
    })();
  }, [districtSlug, pushAlerts, pushDeviceToken, uiLanguage]);

  return null;
}
