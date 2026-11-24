import { describe, expect, it } from "vitest";
import { getDistrictBySlug } from "@/lib/districts";
import { coordinatesForWeather } from "@/lib/weather/location-query";
import { resolveWeatherTarget } from "@/lib/weather/resolve-target";

describe("weather points for places", () => {
  it("never gives a place the fixed point of a district that shares its key, as the attack pass sent it", () => {
    const target = resolveWeatherTarget(new URLSearchParams("place=kampala&name=Kabale%20Test&lat=-1.11&lon=30.11"));
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(coordinatesForWeather(target.district)).toEqual({ lat: -1.11, lon: 30.11 });
    expect(target.cacheKey).toContain("place-point:-1.11:30.11");
  });

  it("still uses the tuned point for the real district", () => {
    const kampala = getDistrictBySlug("kampala")!;
    expect(coordinatesForWeather(kampala)).toEqual({ lat: 0.3136, lon: 32.5811 });
  });
});
