import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;
const authenticatedEnabled = Boolean(process.env.E2E_USER_EMAIL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev:frontend -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "public",
      testIgnore: [/auth\.setup\.ts/, /authenticated\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    ...(authenticatedEnabled
      ? [
          {
            name: "auth-setup",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "authenticated",
            dependencies: ["auth-setup"],
            testMatch: /authenticated\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              storageState: "playwright/.auth/user.json",
            },
          },
        ]
      : []),
  ],
});
