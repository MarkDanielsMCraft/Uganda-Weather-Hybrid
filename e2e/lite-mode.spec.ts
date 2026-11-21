import { expect, test } from "@playwright/test";

test("clicking Lite mode navigates to /lite, persists preference, and returns cleanly via Full app", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "load" });

  const headerLite = page.getByRole("link", { name: /lite mode/i }).first();
  await expect(headerLite).toBeVisible();
  await headerLite.click();

  await page.waitForURL(/\/lite/);
  await expect(page.getByTestId("lite-district-trigger")).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem("uw:preferences"));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored ?? "{}").state.liteModePreference).toBe(true);

  // Full app button returns to main experience cleanly
  await page.getByTestId("lite-back-to-full").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/lite"));
});

test("/lite supports vertical scrolling, auto-closing dropdowns, and the floating advisor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/lite?district=kampala&lang=en", { waitUntil: "load" });

  // Scroll container on /lite must actually scroll vertically
  const scrollInfo = await page.evaluate(() => {
    const el = document.querySelector(".main-scroll") as HTMLElement | null;
    if (!el) return null;
    const before = el.scrollTop;
    el.scrollTop = 120;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      before,
      after: el.scrollTop,
    };
  });
  expect(scrollInfo).not.toBeNull();
  expect(scrollInfo!.scrollHeight).toBeGreaterThan(scrollInfo!.clientHeight);
  expect(scrollInfo!.after).toBeGreaterThan(scrollInfo!.before);

  // Language dropdown opens and closes immediately on selection
  const langTrigger = page.getByTestId("lite-language-dropdown");
  await langTrigger.click();
  const lugandaItem = page.getByRole("menuitemradio", { name: "Luganda" });
  await expect(lugandaItem).toBeVisible();
  await lugandaItem.click();
  await expect(lugandaItem).toBeHidden();
  await page.waitForURL(/lang=lg/);

  // Floating advisor launcher is visible on /lite
  const advisorTrigger = page.getByRole("button", { name: /weather advisor|omuwi w'amagezi/i });
  await expect(advisorTrigger).toBeVisible();
});
