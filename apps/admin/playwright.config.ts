import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "next dev --hostname 127.0.0.1 --port 3100",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          OPENSCENE_AUTH_MODE: "disabled",
          OPENSCENE_STORAGE_DRIVER: "memory",
          OPENSCENE_DATABASE_URL: "file:./data/e2e.db",
        },
      },
});
