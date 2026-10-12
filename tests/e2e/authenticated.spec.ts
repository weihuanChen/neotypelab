import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { prepareCustomKitLiveFixtures } from "./customKitLiveFixtures";
import type { CustomKitSnapshot } from "../../convex/customKitContracts";

test("live Custom Kit single-reference scans and shared generation", async ({ page }) => {
  test.skip(process.env.CUSTOM_KIT_LIVE_QA !== "1", "Real providers require the approved dedicated development test budget.");
  test.setTimeout(30 * 60 * 1000);
  expect(process.env.CONVEX_DEPLOYMENT).toBe("dev:hallowed-raven-873");
  expect(new URL(process.env.VITE_CONVEX_URL!).hostname).toBe("hallowed-raven-873.convex.cloud");
  const fixtures = await prepareCustomKitLiveFixtures();
  const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);
  async function refreshAuth() {
    const token = await page.evaluate(async () => {
      const auth = (window as Window & { Clerk?: { session?: { getToken: (options: { template: string }) => Promise<string | null> } } }).Clerk;
      if (!auth?.session) throw new Error("Dedicated test session unavailable");
      return auth.session.getToken({ template: "convex" });
    });
    expect(token).toBeTruthy();
    client.setAuth(token!);
  }
  await page.goto("/create");
  await expect(page.getByRole("button", { name: "Use as is", exact: true }).first()).toBeVisible();
  await refreshAuth();
  const viewer = await client.query(api.users.viewer, {});
  expect(viewer?.email.toLowerCase()).toBe(process.env.E2E_USER_EMAIL?.toLowerCase());
  const availability = await client.query(api.customKits.availability, {});
  const quote = await client.query(api.creationRuns.quote, {});
  expect(availability.enabled && availability.scanCost != null && quote != null).toBe(true);
  type ScanRow = { kitId?: Id<"customKits">; scanId?: Id<"customKitScans">; eligibility?: string; cost?: number; error?: string };
  type RunRow = { runId?: Id<"creationRuns">; conceptId?: Id<"concepts">; status?: string; screenshot?: string; error?: string; recoveryAttempts?: number };
  const reportPath = "/tmp/neotypelab-custom-kit-live/report.json";
  const report: { initialBalance: number; scanCalls: number; previewCalls: number; scans: Record<string, ScanRow>; runs: Record<string, RunRow> }
    = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : { initialBalance: viewer!.credits.balance, scanCalls: 0, previewCalls: 0, scans: {}, runs: {} };
  const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  save();
  async function remainingBudget() {
    await refreshAuth();
    const current = await client.query(api.users.viewer, {});
    const spent = Math.max(0, report.initialBalance - current!.credits.balance);
    expect(spent).toBeLessThanOrEqual(40);
    return 40 - spent;
  }
  await page.getByRole("button", { name: "Use as is", exact: true }).first().click();
  await page.getByRole("button", { name: "Apply to a kit", exact: true }).click();
  await page.getByRole("group", { name: "Kit source" }).getByRole("button", { name: "Custom Kit", exact: true }).click();
  for (const fixture of fixtures) {
    const row = report.scans[fixture.key] ?? (report.scans[fixture.key] = {});
    if (!row.kitId) {
      const name = `Custom QA 20261012 ${fixture.key}`;
      const prior = (await client.query(api.customKits.mine, {})).find(item => item.name === name);
      if (prior) row.kitId = prior.id;
      else {
        await page.getByRole("textbox", { name: "New Kit name", exact: true }).fill(name);
        await page.locator('#custom-kit-file').setInputFiles(fixture.path);
        await expect.poll(async () => {
          await refreshAuth();
          const mine = await client.query(api.customKits.mine, {});
          return mine.find(item => item.name === name)?.id;
        }, { timeout: 45_000, intervals: [1000] }).toBeTruthy();
        row.kitId = (await client.query(api.customKits.mine, {})).find(item => item.name === name)!.id;
      }
      save();
    }
    if (!row.eligibility) {
      expect(report.scanCalls).toBeLessThan(8);
      expect(await remainingBudget()).toBeGreaterThanOrEqual(availability.scanCost!);
      report.scanCalls += 1; save();
      try {
        row.scanId = await client.action(api.customKitsNode.scan, { kitId: row.kitId, expectedCost: availability.scanCost! });
        const record = await client.query(api.customKits.get, { kitId: row.kitId });
        expect(record!.scanStatus).toBe("succeeded");
        const result = JSON.parse(record!.scanResultJson!);
        row.eligibility = result.eligibility; row.cost = availability.scanCost!; save();
      } catch (failure) {
        row.error = failure instanceof Error ? failure.message.split("\n")[0] : "Scan failed"; save();
        throw failure;
      }
    }
    console.log(`${fixture.key}: ${row.eligibility}`);
    expect(row.eligibility, `${fixture.key} reference suitability`).toBe(fixture.expected);
    if (fixture.expected !== "supported") {
      expect((await client.query(api.customKits.get, { kitId: row.kitId! }))!.versionId).toBeNull();
    }
  }
  // All succeeding scans are free to reuse; Style changes do not consume new scans.
  const repeatBefore = await client.query(api.users.viewer, {});
  const repeat = await client.action(api.customKitsNode.scan, { kitId: report.scans.photo.kitId!, expectedCost: availability.scanCost! });
  expect(repeat).toBe(report.scans.photo.scanId);
  expect((await client.query(api.users.viewer, {}))!.credits.balance).toBe(repeatBefore!.credits.balance);

  const catalog = await client.query(api.catalog.listCreateOptions, {});
  const preset = catalog.stylePresets.find(item => item.slug === "arctic-ops")!;
  const material = catalog.materialPresets.find(item => item.slug === "matte-armor") ?? catalog.materialPresets[0];
  const savedStyle = (await client.query(api.userStyles.mine, {})).find(item => item.status === "active" && (item.intent?.colors?.length ?? 0) >= 7);
  expect(savedStyle, "Reuse the dedicated account's existing seven-color Style without a new interpretation fee").toBeTruthy();
  for (const scenario of [
    { key: "repaint", reference: "photo", modification: "none" },
    { key: "shoulders", reference: "photo", modification: "shoulders" },
    { key: "backpack", reference: "backpack", modification: "backpack" },
    { key: "custom-style", reference: "original", modification: "none" },
  ]) {
    await refreshAuth();
    const row = report.runs[scenario.key] ?? (report.runs[scenario.key] = {});
    if (!row.runId) {
      const kitId = report.scans[scenario.reference].kitId!;
      const record = (await client.query(api.customKits.get, { kitId }))!;
      const snapshot = JSON.parse(record.snapshotJson!) as CustomKitSnapshot;
      const candidates = snapshot.observations.parts.filter(part => part.visibility !== "not-visible");
      const target = scenario.modification === "shoulders" ? candidates.find(part => /shoulder/i.test(`${part.id} ${part.name} ${part.category}`))
        : scenario.modification === "backpack" ? candidates.find(part => /funnel|backpack|wing/i.test(`${part.id} ${part.name} ${part.category}`)) : undefined;
      if (scenario.modification !== "none") expect(target, "The edited structure must be visible in the reference").toBeTruthy();
      const requestedEdits = target ? [{ partId: target.id, action: scenario.modification === "backpack" ? "expand" as const : "adjust" as const,
        description: scenario.modification === "backpack" ? "Spread the existing backpack fin-funnel plates outward into a wider fan. Keep the head, chest, arms and legs unchanged." : "Slightly thicken this shoulder armor while preserving its existing panel layout. Keep the head, chest, arms and legs unchanged." }] : [];
      const versionId = await client.mutation(api.customKits.confirm, { kitId, expectedVersionId: record.versionId!, changesJson: JSON.stringify({ corrections: [], requestedEdits }) });
      expect(report.previewCalls).toBeLessThan(4);
      expect(await remainingBudget()).toBeGreaterThanOrEqual(quote!.cost);
      report.previewCalls += 1; save();
      row.runId = await client.mutation(api.creationRuns.start, { requestKey: `custom-live-${scenario.key}-${randomUUID()}`, expectedCost: quote!.cost,
        input: { customKitId: kitId, customKitVersionId: versionId, materialPresetId: material._id, weatheringLevel: "clean",
          selectionSources: { material: "system-default", weathering: "user-selection" },
          ...(scenario.key === "custom-style" ? { userStyleId: savedStyle!.id, styleIntentJson: JSON.stringify(savedStyle!.intent) }
            : { stylePresetId: preset._id, styleRevision: preset.styleIntentJson, notes: "Use blue and white armor. Keep the reference structure outside explicitly requested local edits." }) },
      });
      save();
    }
    if (row.status !== "succeeded") {
      if (row.status === "failed") {
        expect(row.recoveryAttempts ?? 0, "Only one repair retry is authorized for this allocated case").toBe(0);
        const failed = await client.query(api.creationRuns.latest, {});
        expect(failed!.id).toBe(row.runId);
        expect(failed!.refunded).toBe(true);
        expect(await remainingBudget()).toBeGreaterThanOrEqual(quote!.cost);
        // Restore the same allocated Preview case after a refunded pre-render failure.
        row.recoveryAttempts = 1; save();
        await client.mutation(api.creationRuns.retry, { runId: row.runId! });
        row.status = undefined; row.error = undefined; save();
      }
      let last = "";
      await expect.poll(async () => {
        await refreshAuth();
        const run = await client.query(api.creationRuns.latest, {});
        expect(run!.id).toBe(row.runId);
        const status = `${run!.stage}:${run!.status}`;
        if (status !== last) { console.log(`${scenario.key}: ${status}`); last = status; }
        return run!.status;
      }, { timeout: 9 * 60_000, intervals: [3000] }).toMatch(/^(succeeded|failed)$/);
      const run = (await client.query(api.creationRuns.latest, {}))!;
      row.status = run.status; row.conceptId = run.conceptId; row.error = run.error; save();
      expect(run.error, `${scenario.key} generation result`).toBeFalsy();
      expect(run.status).toBe("succeeded");
      const detail = (await client.query(api.libraryDetails.get, { conceptId: run.conceptId! }))!;
      expect(detail.kit!.grade).toBe("Custom Kit");
      expect(detail.palette!.version).toBe("visual-palette.v3");
      expect(detail.specification!.panels.every(panel => "colorId" in panel && detail.palette!.entries.some(color => color.colorId === panel.colorId))).toBe(true);
      expect(detail.customKit?.requestedEdits.length).toBe(scenario.modification === "none" ? 0 : 1);
      await page.goto(`/library/${run.conceptId}?tab=overview`);
      const image = page.locator(".work-detail-preview img");
      await expect(image).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      row.screenshot = `/tmp/neotypelab-custom-kit-live/${scenario.key}-render.png`;
      await image.screenshot({ path: row.screenshot }); save();
    }
    await remainingBudget();
  }
  console.log(`Custom Kit QA: ${report.scanCalls} scan requests, ${report.previewCalls} previews; ${40 - await remainingBudget()} net Credits`);
});

test("switches between Official Kit and Custom Kit without starting paid work", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("button", { name: "Use as is", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Use as is", exact: true }).first().click();
  await page.getByRole("button", { name: "Apply to a kit", exact: true }).click();
  const source = page.getByRole("group", { name: "Kit source" });
  await expect(source.getByRole("button").first()).toHaveText("Custom Kit");
  await source.getByRole("button", { name: "Custom Kit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bring your own kit." })).toBeVisible();
  await expect(page.getByText("Drop your mecha here", { exact: false })).toBeVisible();
  await expect(page.getByText("Its reference stays private when you publish your build.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Generate preview", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Your preview" }).getByText("Upload, scan and confirm your Custom Kit first.", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/neotypelab-custom-kit-desktop.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".create-mobile-generate").getByRole("button", { name: "Generate", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/neotypelab-custom-kit-mobile.png", animations: "disabled" });
  await source.getByRole("button", { name: "Official Kit", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search kits" })).toBeVisible();
});

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
