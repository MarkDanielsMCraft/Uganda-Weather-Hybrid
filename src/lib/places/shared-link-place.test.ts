// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openPlaceFromLink } from "@/lib/places/shared-link-place";
import { usePreferencesStore } from "@/stores/preferencesStore";

function serverSays(name: string) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        data: { place: { key: "gps-x", name, label: "Near Kampala", lat: 0.3461, lon: 32.6481, parentDistrictSlug: "kampala", region: "central" } },
      }),
      { status: 200 },
    ),
  ) as unknown as typeof fetch;
}

describe("opening a place from a link", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ activePlace: null, recentPlaces: [] });
  });

  it("never shows the name typed into someone else's link, and asks our server instead", async () => {
    const fetcher = serverSays("Kyaliwajala B");
    const opening = openPlaceFromLink({ key: "x8", lat: 0.3461, lon: 32.6481, parentDistrictSlug: "kampala" }, usePreferencesStore, fetcher);
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Shared place");
    await opening;
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Kyaliwajala B");
    expect(JSON.stringify(usePreferencesStore.getState())).not.toMatch(/Flood fund|Okello/);
  });

  it("keeps the name of a place the person chose in the app", async () => {
    const fetcher = serverSays("Somewhere Else");
    usePreferencesStore.getState().selectPlace({
      key: "village-101", name: "Kireka", label: "Kira, Wakiso", lat: 0.346, lon: 32.648, parentDistrictSlug: "wakiso", region: "central",
    });
    await openPlaceFromLink({ key: "village-101", lat: 0.346, lon: 32.648 }, usePreferencesStore, fetcher);
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Kireka");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stays as Shared place when our server cannot name it", async () => {
    const fetcher = vi.fn(async () => new Response("busy", { status: 503 })) as unknown as typeof fetch;
    await openPlaceFromLink({ key: "x9", lat: 0.5, lon: 32.6 }, usePreferencesStore, fetcher);
    expect(usePreferencesStore.getState().activePlace?.name).toBe("Shared place");
  });
});
