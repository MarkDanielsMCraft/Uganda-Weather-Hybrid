// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPlaceLocation } from "@/lib/places/district-from-place";
import { usePreferencesStore } from "@/stores/preferencesStore";

const PLANTED = {
  key: "x8",
  name: "Kampala FLOOD ALERT send mobile money to O77Two scam-help.com",
  label: "Call 0772000000 now",
  lat: 0.31,
  lon: 32.58,
  parentDistrictSlug: "kampala",
  region: "central" as const,
};

describe("places from shared links and saved settings", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ activePlace: null, recentPlaces: [] });
  });

  it("never saves planted text when a shared link selects a place", () => {
    usePreferencesStore.getState().selectPlace(PLANTED);
    const saved = JSON.stringify(usePreferencesStore.getState());
    expect(saved).not.toMatch(/money|scam|0772|Call/i);
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Shared place");
  });

  it("cleans planted text that was already saved on the phone", async () => {
    localStorage.setItem(
      "uw:preferences",
      JSON.stringify({ state: { activePlace: PLANTED, recentPlaces: [PLANTED] }, version: 0 }),
    );
    await usePreferencesStore.persist.rehydrate();
    const state = usePreferencesStore.getState();
    expect(state.activePlace?.name).toBe("Shared place");
    expect(JSON.stringify(state.recentPlaces)).not.toMatch(/money|scam|0772/i);
  });

  it("keeps real place names as they are", () => {
    const place = createPlaceLocation({ key: "village-101", name: "Kireka", label: "Kira, Wakiso", lat: 0.346, lon: 32.648 });
    expect(place.name).toBe("Kireka");
    expect(place.label).toBe("Kira, Wakiso");
  });
});
