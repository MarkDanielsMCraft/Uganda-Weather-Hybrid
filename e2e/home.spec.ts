import { expect, test } from "@playwright/test";

// FR-001: Load home -> see temperature
test("home loads and shows a current temperature", async ({ page }) => {
  await page.goto("/");

  // A "NN°" reading should render without needing to search or select
  // anything first: the app defaults to Kampala.
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("home has no console errors on initial load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});
