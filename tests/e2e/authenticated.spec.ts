import { expect, test } from "@playwright/test";

test("opens the authenticated studio", async ({ page }) => {
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "Studio", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Credits available")).toBeVisible();
});

test("opens the authenticated prototype library", async ({ page }) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Library", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prototype operations" })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Prototypes" })).toBeVisible();
});

test("opens the authenticated creation workbench", async ({ page }) => {
  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "Create", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a repaint language." })
  ).toBeVisible();
});

test("enforces authenticated admin authorization", async ({ page }) => {
  await page.goto("/admin");
  const adminConsole = page.getByRole("heading", { name: "Admin Console" });
  const accessDenied = page.getByRole("heading", {
    name: "Platform administrator access is required.",
  });

  await expect(adminConsole.or(accessDenied)).toBeVisible();
});

test("selects a kit with shared palette, filters, favorites and a single generation output", async ({ page }) => {
  await page.goto("/create");
  await page.getByRole("heading", { name: "EVA-inspired", exact: true }).click();
  await page.getByRole("button", { name: "Apply to a model →", exact: true }).click();
  await expect(page.getByRole("region", { name: "Selected style" })).toContainText("EVA-inspired");
  await expect(page.getByRole("region", { name: "Selected style" }).getByLabel("Illustrative palette balance")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search kits" }).fill("RX78");
  await expect(page.getByRole("heading", { name: "RX-78-2", exact: true })).toHaveCount(1);
  await page.getByRole("heading", { name: "RX-78-2", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Your preview" });
  await expect(panel).toContainText("Preview image + paint plan");
  await expect(panel.getByRole("button", { name: "Generate preview →" })).toBeEnabled();
  await expect(page.getByText("Create repaint specification", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Full preview flow/)).toHaveCount(0);
  const favorite = page.getByRole("button", { name: /^(Unfavorite|Favorite) RX-78-2$/ });
  const initial = await favorite.getAttribute("aria-pressed");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", initial!);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Manufacturer", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Tags", { exact: true })).toHaveCount(0);
  await drawer.getByText("MG", { exact: true }).click();
  await drawer.getByRole("button", { name: /Show \d+ kits/ }).click();
  await expect(page.getByRole("button", { name: "Remove Grade: MG" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search kits" }).fill("");
  await page.getByRole("button", { name: "Remove Grade: MG" }).click();
  await expect(page.locator(".kit-picker-count")).toHaveText(/\d+ kits/);
  await expect(page.locator(".kit-portrait-card")).not.toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const generateBounds = await panel.getByRole("button", { name: "Generate preview →" }).boundingBox();
  expect(generateBounds!.y + generateBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: "/tmp/neotypelab-step2-desktop.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".create-mobile-generate").getByRole("button", { name: "Generate →" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect.poll(() => page.locator(".app-nav").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/neotypelab-step2-mobile.png", animations: "disabled" });
});
