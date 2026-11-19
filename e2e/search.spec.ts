import { expect, test } from "@playwright/test";

// FR-010: Search "Jinja" -> navigate to district
test("searching for a district and selecting a result navigates to its page", async ({ page }) => {
  await page.goto("/search");

  const input = page.getByPlaceholder("Try Kyaziiza, Entebbe, or Gulu");
  await expect(input).toBeVisible();
  await input.fill("Jinja City");

  // Villages literally named "Jinja" exist elsewhere in Uganda and can
  // outrank the district itself in the results, so target the district
  // result specifically rather than "first thing matching /Jinja/". Each
  // row's accessible name is "<title> <subtitle>" (e.g. "Jinja City
  // eastern district"), hence the prefix match rather than an exact one.
  // Requiring "district" in the match also disambiguates from TopBar's own
  // marquee chip button, whose accessible name is "Jinja City <temp>°" and
  // would otherwise match the same loose prefix while mid-animation.
  const result = page.getByRole("button", { name: /^Jinja City\b.*district/ }).first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();

  // A generous timeout here, not a short default one: this navigation can
  // wait on a real weather fetch for the target district. Under a slow or
  // degraded network (seen in CI, where the primary provider sometimes
  // fails outright and the app correctly falls through to its backup),
  // that fallback chain can itself take several seconds before the page
  // renders, this is the app's resilience working as designed, not a bug,
  // so the test needs to tolerate the same latency budget.
  await expect(page).toHaveURL(/\/district\/jinja-city/, { timeout: 20_000 });
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("shows popular districts by default and narrows as you type", async ({ page }) => {
  await page.goto("/search");

  await expect(page.getByText(/popular districts/i)).toBeVisible();

  const input = page.getByPlaceholder("Try Kyaziiza, Entebbe, or Gulu");
  await input.fill("zzzznotaplace");

  await expect(page.getByText(/no places matched/i)).toBeVisible({ timeout: 10_000 });
});

test("a one-character query doesn't trigger a search (matches the API's 2-char minimum)", async ({
  page,
}) => {
  await page.goto("/search");
  const input = page.getByPlaceholder("Try Kyaziiza, Entebbe, or Gulu");
  await input.fill("k");

  // Popular districts should still be showing, not a "no matches" result.
  await expect(page.getByText(/popular districts/i)).toBeVisible();
});

// Regression test: the desktop header's search dropdown used to render
// behind the page content it visually overlaps. `<header>` uses
// `backdrop-blur-2xl`, which creates its own CSS stacking context, but had
// no explicit `z-index` of its own — so `<main>` (its DOM sibling,
// rendered right after it, also `z-index: auto`) won the paint/hit-test
// order on the DOM-order tiebreak and silently swallowed clicks meant for
// the dropdown's results, even though the dropdown was clearly visible
// on screen. Only reproduces at the desktop breakpoint where this header
// (not the mobile `/search` page) is what renders the dropdown.
test("desktop header search dropdown result is actually clickable, not covered by page content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const input = page.getByPlaceholder("Search districts or villages");
  await expect(input).toBeVisible();
  await input.fill("Kyotera");

  const result = page.getByRole("button", { name: /^Kyotera\b.*district/ }).first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();

  // See the comment on the equivalent assertion above: this can wait on a
  // real weather fetch (with fallback) for the target district.
  await expect(page).toHaveURL(/\/district\/kyotera/, { timeout: 20_000 });
});

// Hyperlocal: searching a specific village (not a district) resolves to
// its own coordinates via createPlaceLocation/districtFromPlace, and the
// home screen re-renders real weather for that exact point.
test("searching a village navigates to its own place-based weather, not just the parent district", async ({
  page,
}) => {
  await page.goto("/search");

  const input = page.getByPlaceholder("Try Kyaziiza, Entebbe, or Gulu");
  await expect(input).toBeVisible();
  await input.fill("Kyaziiza");

  const result = page.getByRole("button", { name: /^Kyaziiza\b/ }).first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();

  // See the comment on the equivalent assertion in the first test above:
  // this can wait on a real weather fetch (with fallback) for the target
  // place.
  await expect(page).toHaveURL(/place=/, { timeout: 20_000 });
  await expect(
    page.locator(".text-on-sky-strong", { hasText: /-?\d{1,3}°/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
});
