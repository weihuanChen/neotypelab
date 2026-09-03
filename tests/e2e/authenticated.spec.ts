import { expect, test } from "@playwright/test";

test("opens the authenticated studio", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  await expect(page.getByText("Credits available")).toBeVisible();
});

test("opens the authenticated prototype library", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByText(/Prototype archive|No prototypes yet/)).toBeVisible();
});
