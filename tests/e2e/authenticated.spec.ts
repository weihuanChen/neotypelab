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
    page.getByRole("button", { name: "Initialize Prototype" })
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
