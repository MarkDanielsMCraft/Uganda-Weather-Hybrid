import { expect, test } from "@playwright/test";

// Most phones cannot run Gemini Nano, and neither can this test browser. When
// the advisor is offline it must still answer, from the saved forecast, and
// say plainly that the answer was made without AI.

test("the advisor answers offline from the saved forecast when no on-device model exists", async ({ page }) => {
  await page.goto("/");
  const essentialOnly = page.getByRole("button", { name: "Essential only" });
  if (await essentialOnly.isVisible().catch(() => false)) await essentialOnly.click();

  await page.getByRole("button", { name: /weather advisor/i }).click();
  await page.getByTestId("advisor-runtime-badge").click();
  await page.getByRole("button", { name: "Offline", exact: true }).click();

  // The suggested questions follow the time of day ("today" in the daytime,
  // "tomorrow" in the evening), so match the farming one at any hour.
  await page.getByRole("button", { name: /farm or dry crops/i }).first().click();

  const source = page.getByTestId("advisor-source-badge").last();
  await expect(source).toHaveText("Saved forecast", { timeout: 20_000 });
  await expect(page.getByText(/Made from the saved numbers only, without AI\./).last()).toBeVisible();
});
