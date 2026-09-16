import { expect, test, type Page } from "@playwright/test";

test("renders the public discovery page", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/NeotypeLab/);
  await expect(page.getByRole("heading", { name: "Today's prototypes" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("shows the signed-out create gate", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "Prototype a spray-ready repaint before you paint." })
  ).toBeVisible();
  const createGate = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Prototype a spray-ready repaint before you paint.",
    }),
  });
  await expect(createGate.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("redirects legacy terminal create links", async ({ page }) => {
  await page.goto("/t/create?recommendedStyle=command-unit");
  await expect(page).toHaveURL(/\/create\?recommendedStyle=command-unit$/);
});

test("redirects the spec admin index", async ({ page }) => {
  await page.goto("/spec-admin");
  await expect(page).toHaveURL(/\/spec-admin\/materials$/);
});

test("renders the application not-found boundary", async ({ page }) => {
  await page.goto("/integration-test-missing-route");
  await expect(
    page.getByRole("heading", { name: "This NeotypeLab route does not exist." })
  ).toBeVisible();
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

test("gates private work details and preserves the resource tab URL", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.goto("/library/unavailable-work?tab=resources");
  await expect(page.getByRole("heading", { name: "Sign in to view this work." })).toBeVisible();
  await expect(page).toHaveURL(/\/library\/unavailable-work\?tab=resources$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/library");
  await expect(page.getByRole("tab", { name: /Resources/ })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("opens Styles from discovery and handles an unpopulated collection", async ({ page }) => {
  await page.goto("/styles");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Styles", exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/styles$/);
  // A deployment without the new Convex functions must render a recoverable, noindex state.
  if (await page.getByRole("heading", { name: "The collection is taking a moment." }).isVisible()) {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Reload styles" })).toHaveAttribute("href", "/styles");
  } else {
    await expect(page.getByRole("heading", { name: /A different kit/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Featured", exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator("#app-primary-navigation")).toHaveAttribute("aria-hidden", "true");
  await page.screenshot({ path: "/tmp/neotypelab-styles-mobile.png", fullPage: true, animations: "disabled" });
});

test("does not index an unavailable or unreviewed style pairing", async ({ page }) => {
  await page.goto("/styles/integration-missing-style/integration-missing-kit");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("gates the editorial review workspace", async ({ page }) => {
  await page.goto("/admin/style-editorial");
  await expect(page.getByRole("heading", { name: "Sign in to open the admin console." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("keeps the community gallery closed and hides its discovery entry", async ({ page }) => {
  const response = await page.goto("/community/styles");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This NeotypeLab route does not exist." })).toBeVisible();
  await page.goto("/styles");
  await expect(page.getByRole("link", { name: "Community", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/community/styles"]')).toHaveCount(0);
});

test("does not index unavailable custom style links", async ({ page }) => {
  await page.goto("/c/integration-unavailable-style");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("preserves the community style when opening the create sign-in gate", async ({ page }) => {
  await page.goto("/create?communityStyle=integration-shared-style");
  await expect(page).toHaveURL(/communityStyle=integration-shared-style/);
  await expect(page.getByRole("heading", { name: "Prototype a spray-ready repaint before you paint." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true }).last()).toBeVisible();
});
