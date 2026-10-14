import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/._*",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 12000 },
  use: {
    baseURL: "http://localhost:3007",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3007",
    url: "http://localhost:3007/login",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
