"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getDistrictBySlug } from "@/lib/districts";
import { districtHomeHref, placeHomeHref } from "@/lib/places/share";
import { parseDeepLink } from "@/lib/native/deep-links";
import { isNativeApp } from "@/lib/native/platform";
import { requestNativeAppPermissions } from "@/lib/native/startup-permissions";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { openPlaceFromLink } from "@/lib/places/shared-link-place";
import { useOptionalDetailSheet } from "@/components/sheet/DetailSheetProvider";

function buildModuleHref(
  modulePath: string,
  alertId: string | null,
  districtSlug: string | null,
) {
  const params = new URLSearchParams();
  if (districtSlug) params.set("district", districtSlug);
  if (alertId) params.set("alert", alertId);
  const query = params.toString();
  return query ? `${modulePath}?${query}` : modulePath;
}

export function CapacitorBootstrap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detailSheet = useOptionalDetailSheet();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);
  const selectPlace = usePreferencesStore((state) => state.selectPlace);

  const sheetRef = useRef(detailSheet?.sheet);
  sheetRef.current = detailSheet?.sheet;
  const closeSheetRef = useRef(detailSheet?.closeSheet);
  closeSheetRef.current = detailSheet?.closeSheet;

  useEffect(() => {
    let cancelled = false;
    let removeListeners: (() => void) | undefined;

    async function bootstrap() {
      if (!(await isNativeApp()) || cancelled) return;

      const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/app"),
      ]);

      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: "#1a1524" }).catch(() => undefined);
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      await SplashScreen.hide().catch(() => undefined);

      // Prompt for necessary permissions on first launch
      const currentDistrict = usePreferencesStore.getState().districtSlug;
      void requestNativeAppPermissions(currentDistrict);

      const urlListener = await App.addListener("appUrlOpen", (event) => {
        const parsed = parseDeepLink(event.url);
        if (!parsed) return;

        let districtSlug: string | null = null;

        if (parsed.location?.kind === "place") {
          const linked = parsed.location.place;
          void openPlaceFromLink(
            { key: linked.key, lat: linked.lat, lon: linked.lon, parentDistrictSlug: linked.parentDistrictSlug },
            usePreferencesStore,
          );
          districtSlug = linked.parentDistrictSlug;
          if (typeof window !== "undefined" && !parsed.modulePath) {
            window.history.replaceState(null, "", placeHomeHref(usePreferencesStore.getState().activePlace ?? linked));
          }
        } else if (parsed.location?.kind === "district" && getDistrictBySlug(parsed.location.slug)) {
          selectDistrict(parsed.location.slug);
          districtSlug = parsed.location.slug;
          if (typeof window !== "undefined" && !parsed.modulePath) {
            window.history.replaceState(null, "", districtHomeHref(parsed.location.slug));
          }
        }

        if (parsed.modulePath) {
          router.push(buildModuleHref(parsed.modulePath, parsed.alertId, districtSlug));
        }
      });

      const backListener = await App.addListener("backButton", ({ canGoBack }) => {
        if (sheetRef.current) {
          closeSheetRef.current?.();
          return;
        }
        if (canGoBack) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });

      const stateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          void queryClient.invalidateQueries();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("uw:app-resumed"));
          }
        }
      });

      removeListeners = () => {
        void urlListener.remove();
        void backListener.remove();
        void stateListener.remove();
      };
    }

    void bootstrap();

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, [queryClient, router, selectDistrict, selectPlace]);

  return null;
}
