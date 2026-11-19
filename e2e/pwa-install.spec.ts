import { expect, test } from "@playwright/test";

// FR-110: Manifest present
test("the home page links a valid, installable web app manifest", async ({ page, request }) => {
  await page.goto("/");

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();

  const response = await request.get(manifestHref!);
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toBe("Uganda Weather");
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBeTruthy();
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);
  for (const icon of manifest.icons) {
    expect(icon.src).toBeTruthy();
    expect(icon.sizes).toBeTruthy();
  }
});

test("the home page registers a service worker for offline/PWA support", async ({ page }) => {
  await page.goto("/");
  const hasServiceWorkerSupport = await page.evaluate(() => "serviceWorker" in navigator);
  expect(hasServiceWorkerSupport).toBe(true);
});
