"use client";

import { useRouter } from "next/navigation";
import { usePreferencesStore } from "@/stores/preferencesStore";
import type { PlaceLocation } from "@/lib/places/types";
import { districtHomeHref, placeHomeHref } from "@/lib/places/share";

export { districtHomeHref, placeHomeHref };

export function useDistrictNavigation() {
  const router = useRouter();
  const selectDistrict = usePreferencesStore((state) => state.selectDistrict);
  const selectPlace = usePreferencesStore((state) => state.selectPlace);

  return {
    // router.replace (not raw window.history.replaceState, which only
    // rewrites the URL bar string without telling Next's App Router to
    // actually re-render) so picking a new city while on a module page
    // like Fields or Alerts takes you to that district's "Now" page
    // instead of silently changing the address bar while leaving you on
    // the same module screen with the new district's data underneath it.
    selectDistrict: (slug: string) => {
      selectDistrict(slug);
      router.replace(districtHomeHref(slug));
      const scrollEl = document.querySelector<HTMLElement>(".main-scroll");
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    selectPlace: (place: PlaceLocation) => {
      selectPlace(place);
      router.replace(placeHomeHref(place));
      const scrollEl = document.querySelector<HTMLElement>(".main-scroll");
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: "instant" });
      }
    },
  };
}
