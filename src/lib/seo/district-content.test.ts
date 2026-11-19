import { describe, expect, it } from "vitest";
import { buildDistrictContent, districtFaqStructuredData } from "./district-content";
import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";

function content(slug: string) {
  const district = getDistrictBySlug(slug);
  if (!district) throw new Error(`missing fixture district ${slug}`);
  return buildDistrictContent(district);
}

describe("buildDistrictContent", () => {
  it("describes a bimodal district's two seasons", () => {
    const bukomansimbi = content("bukomansimbi");
    expect(bukomansimbi.seasons).toContain("two rainy seasons");
    expect(bukomansimbi.intro).toContain("Bukomansimbi");
    expect(bukomansimbi.intro).toContain("Central");
  });

  it("describes a unimodal district's single season differently", () => {
    const gulu = content("gulu");
    expect(gulu.seasons).toContain("one long rainy season");
    expect(gulu.seasons).not.toContain("two rainy seasons");
  });

  it("gives each district its own text rather than a shared template", () => {
    const a = content("bukomansimbi");
    const b = content("gulu");
    expect(a.seasons).not.toBe(b.seasons);
    expect(a.farming).not.toBe(b.farming);
  });

  it("produces substantial crawlable copy for every district", () => {
    for (const district of getAllDistricts()) {
      const built = buildDistrictContent(district);
      const total = [built.intro, built.seasons, built.farming, built.hazards ?? "", built.lake ?? ""]
        .join(" ")
        .trim();
      expect(total.length).toBeGreaterThan(400);
      expect(built.faq.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("districtFaqStructuredData", () => {
  it("emits a FAQPage with answered questions", () => {
    const district = getDistrictBySlug("bukomansimbi");
    if (!district) throw new Error("missing fixture district");
    const data = districtFaqStructuredData(district);

    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.length).toBeGreaterThanOrEqual(4);
    for (const entry of data.mainEntity) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });
});
