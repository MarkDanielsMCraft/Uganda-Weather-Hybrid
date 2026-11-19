import { expect, test } from "@playwright/test";

// FR-014: Direct URL /district/kampala works
test("a direct district URL loads that district's weather without redirecting through search", async ({
  page,
}) => {
  await page.goto("/district/kampala");

  await expect(page).toHaveURL(/\/district\/kampala/);
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
  // The district name renders as the hero link back to search.
  await expect(page.getByRole("link", { name: "Kampala", exact: true }).first()).toBeVisible();
});

test("an unknown district slug renders a 404, not a crash", async ({ page }) => {
  const response = await page.goto("/district/not-a-real-district-xyz");
  expect(response?.status()).toBe(404);
});

test("direct URLs work for a district other than the default (Jinja)", async ({ page }) => {
  await page.goto("/district/jinja-city");
  await expect(page).toHaveURL(/\/district\/jinja-city/);
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
});
