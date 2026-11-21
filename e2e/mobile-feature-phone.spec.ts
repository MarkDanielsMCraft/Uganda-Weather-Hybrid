import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORTS = [
  { name: "KaiOS Feature Phone (240x320)", width: 240, height: 320, routes: ["/lite?district=kampala&lang=en"] },
  { name: "Small Android Go (320x568)", width: 320, height: 568, routes: ["/lite?district=kampala&lang=en", "/"] },
  { name: "Uganda Budget Smartphone (360x640)", width: 360, height: 640, routes: ["/", "/lite?district=kampala&lang=en"] },
  { name: "Standard Mobile (375x812)", width: 375, height: 812, routes: ["/", "/lite?district=kampala&lang=lg"] },
] as const;

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(vp.name, () => {
    for (const route of vp.routes) {
      test(`renders ${route} with zero horizontal overflow and contained popovers`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route, { waitUntil: "load" });

        const advisorLauncher = page.getByRole("button", {
          name: /weather advisor|omuwi w'amagezi/i,
        });

        if (route.startsWith("/lite")) {
          await expect(page.getByTestId("lite-district-trigger")).toBeVisible({ timeout: 15_000 });
        } else {
          await expect(advisorLauncher).toBeVisible({ timeout: 15_000 });
        }

        // Assert zero horizontal overflow
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

        // On /lite, verify district picker opens within viewport bounds and closes on Escape
        if (route.startsWith("/lite")) {
          const trigger = page.getByTestId("lite-district-trigger");
          await trigger.click();
          const listbox = page.getByRole("listbox");
          await expect(listbox).toBeVisible();
          const box = await listbox.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
          await page.keyboard.press("Escape");
          await expect(listbox).toBeHidden();
        }

        // Verify floating Hybrid Advisor opens within viewport bounds on >= 320px screens
        if (vp.width >= 320) {
          await expect(advisorLauncher).toBeVisible();
          await advisorLauncher.click();
          const runtimeBadge = page.getByTestId("advisor-runtime-badge");
          await expect(runtimeBadge).toBeVisible();
          const badgeBox = await runtimeBadge.boundingBox();
          expect(badgeBox).not.toBeNull();
          expect(badgeBox!.x).toBeGreaterThanOrEqual(0);
          expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(vp.width + 1);
          await page.keyboard.press("Escape");
          await expect(runtimeBadge).toBeHidden();
        }
      });
    }
  });
}
