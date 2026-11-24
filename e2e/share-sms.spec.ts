import { expect, test } from "@playwright/test";

// On a computer the browser asks before opening the Messages app, which looks
// broken, so SMS sharing is offered only on touch devices. WhatsApp and Copy
// stay available everywhere.

test("computers with a mouse see WhatsApp and Copy, but no SMS button", async ({ page }) => {
  await page.goto("/lite?district=kampala&lang=en");

  await expect(page.getByRole("link", { name: "Share forecast on WhatsApp" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy forecast text" })).toBeVisible();
  await expect(page.getByTestId("share-sms")).toBeHidden();
});

test.describe("touch phone", () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test("phones see the SMS button with a ready to send message", async ({ page }) => {
    await page.goto("/lite?district=kampala&lang=en");

    const sms = page.getByTestId("share-sms");
    await expect(sms).toBeVisible();
    await expect(sms).toHaveAttribute("href", /^sms:\?&body=Uganda%20Weather%20Kampala/);
  });
});
