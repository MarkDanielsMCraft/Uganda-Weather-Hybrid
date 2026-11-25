import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  /**
   * Every worker shares one outbound IP (localhost, or the CI runner), and
   * so shares one bucket in the app's own rate limiter (60 req/60s/IP).
   * A handful of workers each loading a couple of pages easily exceeds
   * that within a few seconds, not a bug, but it makes the suite flaky
   * against itself. Capped rather than left unbounded. CI additionally has
   * no WEATHERAPI_KEY configured, so every request falls through to
   * Open-Meteo's free, keyless tier, which has its own much lower rate
   * limit and is shared across many GitHub Actions runners on the same IP
   * range, single worker to keep concurrent external calls low.
   */
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "pnpm start" : "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
