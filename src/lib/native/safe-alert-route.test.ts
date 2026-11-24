import { describe, expect, it } from "vitest";
import { safeAlertRoute } from "@/lib/native/deep-links";

describe("safeAlertRoute", () => {
  it("keeps paths inside the app", () => {
    expect(safeAlertRoute("/alerts?district=gulu")).toBe("/alerts?district=gulu");
    expect(safeAlertRoute("district/kampala")).toBe("/district/kampala");
  });

  it("sends anything that could leave the app to the alerts page", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/x:y", "/<script>", 42, null]) {
      expect(safeAlertRoute(bad)).toBe("/alerts");
    }
  });
});
