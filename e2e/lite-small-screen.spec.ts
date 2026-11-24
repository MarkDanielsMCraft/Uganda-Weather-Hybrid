import { expect, test } from "@playwright/test";

// On the smallest feature phone screens, every word on /lite must be readable:
// no text cut short with an ellipsis and nothing pushed past the right edge.

for (const lang of ["en", "lg"] as const) {
  test(`/lite at 240x320 shows full words in ${lang === "en" ? "English" : "Luganda"}`, async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto(`/lite?district=kampala&lang=${lang}`);
    await expect(page.getByTestId("lite-district-trigger")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("a[href^='https://wa.me']")).toBeVisible({ timeout: 15_000 });

    const problems = await page.evaluate(() => {
      const width = window.innerWidth;
      const cut: string[] = [];
      const outside: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("main *"))) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        if (style.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) {
          cut.push((el.textContent ?? "").trim().slice(0, 30));
        }
        if (box.right > width + 1 && el.children.length === 0) {
          outside.push((el.textContent ?? el.tagName).trim().slice(0, 30));
        }
      }
      return { cut, outside };
    });

    expect(problems.cut, "text cut short").toEqual([]);
    expect(problems.outside, "content past the right edge").toEqual([]);
  });
}
