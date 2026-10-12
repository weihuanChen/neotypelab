import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

test("opens the authenticated studio", async ({ page }) => {
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "Studio", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Credits available")).toBeVisible();
});

test("live Style v3 color overrides, ratios and seven-color generation", async ({ page }) => {
  test.skip(process.env.STYLE_LIVE_QA !== "1", "Opt-in provider validation uses the dedicated development test account.");
  test.setTimeout(18 * 60 * 1000);
  const url = process.env.VITE_CONVEX_URL;
  expect(url && new URL(url).hostname).toBe("hallowed-raven-873.convex.cloud");
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Choose a color direction." })).toBeVisible();
  const client = new ConvexHttpClient(url!);
  async function refreshAuth() {
    const token = await page.evaluate(async () => {
      const auth = (window as Window & { Clerk?: { session?: { getToken: (options: { template: string }) => Promise<string | null> } } }).Clerk;
      if (!auth?.session) throw new Error("The dedicated test session is unavailable");
      return await auth.session.getToken({ template: "convex" });
    });
    expect(token).toBeTruthy();
    client.setAuth(token!);
  }
  await refreshAuth();
  const catalog = await client.query(api.catalog.listCreateOptions, {});
  const quote = await client.query(api.creationRuns.quote, {});
  const style = catalog.stylePresets.find((entry) => entry.slug === "arctic-ops");
  const kit = catalog.kitVariants.find((entry) => entry.name === "RX-78-2") ?? catalog.kitVariants[0];
  const material = catalog.materialPresets.find((entry) => entry.slug === "matte-armor") ?? catalog.materialPresets[0];
  const interpretationCost = catalog.priceRules.find((entry) => entry.actionType === "generate-style-suggestion")?.creditCost;
  expect(style && kit && material && quote && interpretationCost !== undefined).toBeTruthy();
  expect(quote!.cost * 3 + interpretationCost!).toBeLessThanOrEqual(25);
  const reportPath = "/tmp/neotypelab-style-live-report.json";
  const report = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, { runId: string; conceptId: string; credits: number; screenshot: string }>
    : {};
  const pendingPath = "/tmp/neotypelab-style-live-pending.json";
  const pending = existsSync(pendingPath)
    ? JSON.parse(readFileSync(pendingPath, "utf8")) as Record<string, { runId?: Id<"creationRuns">; styleId?: Id<"userStyles">; intentJson?: string }>
    : {};
  const savePending = () => writeFileSync(pendingPath, JSON.stringify(pending, null, 2) + "\n");

  const description = "Use red, blue, green, orange, purple, yellow and pink as seven large armor colors. Keep the kit silhouette and weapon geometry. A clean matte finish.";
  const common = {
    kitVariantId: kit._id, materialPresetId: material._id, weatheringLevel: "clean" as const,
    selectionSources: { material: "system-default" as const, weathering: "user-selection" as const },
  };
  for (const scenario of [
    { key: "blue-white", notes: "Use blue and white armor. Keep the original kit geometry." },
    { key: "ratio-70-30", notes: "70% blue armor, 30% white armor. Keep the original kit geometry." },
    { key: "seven-colors", notes: undefined },
  ]) {
    await refreshAuth();
    if (report[scenario.key]) {
      const previous = await client.query(api.libraryDetails.get, { conceptId: report[scenario.key].conceptId });
      expect(previous?.palette?.version).toBe("visual-palette.v3");
      console.log(`${scenario.key}: reusing validated private dev result (${report[scenario.key].runId})`);
      continue;
    }
    let runId = pending[scenario.key]?.runId;
    if (runId) {
      const previous = await client.query(api.creationRuns.latest, {});
      expect(previous?.id, "Recovery must belong to the latest dedicated test run").toBe(runId);
      if (previous?.status === "failed") {
        expect(previous.refunded).toBe(true);
        await client.mutation(api.creationRuns.retry, { runId });
      }
      console.log(`${scenario.key}: resuming saved run (${runId})`);
    } else {
      if (scenario.key === "seven-colors" && !pending[scenario.key]?.styleId) {
        const interpretation = await client.action(api.prototypeTools.interpretCustomStyle, { description, requestKey: `style-live-${randomUUID()}` });
        const saved = await client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
        pending[scenario.key] = { styleId: saved.styleId, intentJson: JSON.stringify(saved.intent) };
        savePending();
      }
      const saved = pending[scenario.key];
      if (saved?.styleId && !saved.intentJson) {
        const stored = (await client.query(api.userStyles.mine, {})).find((entry) => entry.id === saved.styleId);
        expect(stored?.status).toBe("active");
        saved.intentJson = JSON.stringify(stored!.intent);
        savePending();
      }
      runId = await client.mutation(api.creationRuns.start, {
        requestKey: `style-live-${scenario.key}-${randomUUID()}`, expectedCost: quote!.cost,
        input: { ...common, notes: scenario.notes,
          ...(saved?.styleId ? { userStyleId: saved.styleId, ...(saved.intentJson ? { styleIntentJson: saved.intentJson } : {}) }
            : { stylePresetId: style!._id, styleRevision: style!.styleIntentJson }),
        },
      });
      pending[scenario.key] = { ...saved, runId };
      savePending();
    }
    let lastState = "";
    await expect.poll(async () => {
      await refreshAuth();
      const run = await client.query(api.creationRuns.latest, {});
      if (run?.id !== runId) return "missing";
      const state = `${run.stage}:${run.status}`;
      if (state !== lastState) { console.log(`${scenario.key}: ${state}`); lastState = state; }
      return run.status;
    }, { timeout: 8 * 60 * 1000, intervals: [3000] }).toMatch(/^(succeeded|failed)$/);
    const run = await client.query(api.creationRuns.latest, {});
    expect(run?.error, `${scenario.key} provider result`).toBeFalsy();
    expect(run?.status).toBe("succeeded");
    const detail = await client.query(api.libraryDetails.get, { conceptId: run!.conceptId! });
    expect(detail?.palette?.version).toBe("visual-palette.v3");
    expect(detail?.specification && "version" in detail.specification && detail.specification.version).toBe("repaint-specification.v3");
    await page.goto(`/library/${run!.conceptId}?tab=overview`);
    const image = page.locator(".work-detail-preview img");
    await expect(image).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await image.screenshot({ path: `/tmp/neotypelab-style-${scenario.key}.png`, style: ".work-detail-zoom { visibility: hidden; }" });
    const resolved = JSON.parse(detail!.resolvedIntentJson!) as { colors: Array<{ colorId: string; scope: { kind: string }; visualRole: string; coverage?: { percent: number; strength: string } }> };
    if (scenario.key === "blue-white") expect(resolved.colors.some((color) => color.coverage?.strength === "hard")).toBe(false);
    if (scenario.key === "ratio-70-30") expect(resolved.colors.filter((color) => color.coverage?.strength === "hard").map((color) => color.coverage!.percent).sort()).toEqual([30, 70]);
    if (scenario.key === "seven-colors") {
      expect(resolved.colors.filter((color) => color.scope.kind === "exterior-armor" && ["primary", "secondary"].includes(color.visualRole)).length).toBeGreaterThanOrEqual(7);
      expect(detail!.palette!.entries.filter((color) => ["primary-armor", "secondary-armor"].includes(color.roleSlug)).length).toBeGreaterThanOrEqual(7);
    }
    expect(detail!.palette!.entries.every((color) => detail!.specification!.panels.some((panel) => "colorId" in panel && panel.colorId === color.colorId))).toBe(true);
    report[scenario.key] = { runId, conceptId: run!.conceptId!, credits: quote!.cost + (scenario.key === "seven-colors" ? interpretationCost! : 0), screenshot: `/tmp/neotypelab-style-${scenario.key}.png` };
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`${scenario.key}: validated Palette, Specification and Render (${runId})`);
  }
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
    page.getByRole("heading", { name: "Choose a color direction." })
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
  await page.getByRole("button", { name: /Browse all/ }).click();
  await page.getByRole("textbox", { name: "Search styles" }).fill("EVA-inspired");
  await page.getByRole("heading", { name: "EVA-inspired", exact: true }).click();
  await page.getByRole("button", { name: "Apply to a kit →", exact: true }).click();
  await expect(page.getByRole("region", { name: "Selected style" })).toContainText("EVA-inspired");
  await expect(page.getByRole("region", { name: "Selected style" }).getByLabel("Illustrative palette balance")).toBeVisible();
  const refinements = page.getByRole("textbox", { name: /Refine this style/ });
  await expect(refinements).toHaveAttribute("maxlength", "2000");
  await refinements.fill("Use blue and white armor. Keep the original kit geometry.");
  await expect(refinements).toHaveValue("Use blue and white armor. Keep the original kit geometry.");
  await expect(page.getByText("Proportions stay open unless you specify them.", { exact: false })).toBeVisible();
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
