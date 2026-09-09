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
