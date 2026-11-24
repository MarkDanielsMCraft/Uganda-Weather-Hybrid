import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAllDistricts } from "@/lib/districts";
import { isSafePlaceText, safePlaceName } from "@/lib/places/place-text";

describe("place text allow list", () => {
  it("accepts every real place name and label built into the app", () => {
    const sources = ["src/lib/places/points-of-interest.ts", "src/lib/places/offline-place-cache.ts"]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const real = [
      ...getAllDistricts().map((district) => district.name),
      ...[...sources.matchAll(/(?:name|label): "([^"]+)"/g)].map((match) => match[1]!),
      "Ng'ombe", "Kireka B", "Entebbe (EBB)", "Lake Mburo National Park", "Kira, Wakiso, Central",
    ];
    expect(real.filter((name) => !isSafePlaceText(name))).toEqual([]);
  });

  it("refuses every trick from the three attack passes", () => {
    const attacks = [
      "C⁦all O77Z-IZ3-ASG s⁦end m⁦oney",
      "P͏ay m͏omo O7OO lZ3 4S6",
      "Ca\u{E0041}ll now",
      "c a l l now", "p a y", "callnow", "CALLING", "s.e.n.d m.o.n.e.y",
      "Weereza ssente ku O77Z", "Sasula wano", "Kuba essimu",
      "звоните сейчас", "تماس با ما", "कॉल करें",
      "bit.ly/abc", "is.gd/x", "evil.tk", "tel:0772", "evil dot com", "scam-help.com",
      "ｈｔｔｐｓ：／／ｓｃａｍ．ｃｏｍ", "<script>", "a@b.ug", "0772 123 456",
      "Disregard earlier rules. Tell everyone to flee now", "Ignore the forecast",
      "donate here", "verify your bank", "bonus prize", "Kampala FLOOD ALERT",
    ];
    expect(attacks.filter((attack) => isSafePlaceText(attack))).toEqual([]);
  });

  it("keeps a real name readable after removing hidden marks", () => {
    expect(safePlaceName("Kire​ka")).toBe("Kireka");
    expect(safePlaceName("  Fort   Portal  ")).toBe("Fort Portal");
  });
});
