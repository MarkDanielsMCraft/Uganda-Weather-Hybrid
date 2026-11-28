// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractReadableCardText } from "./dom-narration";

describe("extractReadableCardText", () => {
  it("preserves spaces between adjacent inline elements while keeping degree and percent suffixes tight", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <p>0<span>Wansi</span></p>
      <p><span>hPa</span>1014</p>
      <p>78%</p>
      <p>Today's high of 28° matches Kampala.</p>
    `;

    expect(extractReadableCardText(container, "Obukambwe bw'omusana")).toBe(
      "Obukambwe bw'omusana. 0 Wansi. hPa 1014. 78%. Today's high of 28° matches Kampala.",
    );
  });

  it("skips data-no-narrate, svg, sr-only, aria-hidden, inputs, and missing-metric dash rows while keeping airport button rows", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-no-narrate><button>Leero 26</button><button>Enkya 27</button></div>
      <p>Enjuba egudde leero.</p>
      <svg><text>Hidden SVG</text></svg>
      <span class="sr-only">Screen reader hint</span>
      <span aria-hidden="true">•••</span>
      <button type="button">
        <div>
          <p>Entebbe International</p>
          <span data-no-narrate>VFR</span>
        </div>
        <p>Butangaavu, obudde bulungi eri ennyonyi</p>
        <p>Ebbugumu <span>24°</span></p>
        <p>Altimita <span>—</span></p>
        <p data-no-narrate>HUEN 261800Z 16008KT 9999 FEW020 24/19 Q1015</p>
      </button>
    `;

    expect(extractReadableCardText(container, "Enjuba okugwa")).toBe(
      "Enjuba okugwa. Enjuba egudde leero. Entebbe International. Butangaavu, obudde bulungi eri ennyonyi. Ebbugumu 24°.",
    );
  });
});
