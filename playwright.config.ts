import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  outputDir: "artifacts/test-results",
  use: {
    baseURL: "http://127.0.0.1:4176",
    launchOptions: {
      args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4176 --strictPort",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
});
