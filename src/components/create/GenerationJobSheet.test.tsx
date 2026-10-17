// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationJobSheet, type CreationRunRecord } from "./GenerationJobSheet";

vi.mock("@/src/hooks/usePrivateAssetUrl", () => ({ usePrivateAssetUrl: (id?: string | null) => id === "reference-object" ? "https://signed.example.test/reference.png" : null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>,
}));

describe("GenerationJobSheet Component", () => {
  const baseRun: CreationRunRecord = {
    id: "run-001" as any,
    jobId: "NPL-0248",
    status: "running",
    stage: "palette",
    cost: 8,
    refunded: false,
    title: "MG Barbatos × Eva-Inspired",
    kit: {
      id: "kit-001" as any,
      name: "MG Barbatos",
      grade: "MG",
      scale: "1/100",
      portrait: "https://cdn.example.test/cover.webp",
      fullBody: "https://cdn.example.test/fullbody.webp",
    },
    styleName: "Eva-Inspired",
    styleSlug: "eva-inspired",
    visualPalette: {
      primary: "#684690",
      accent: "#96C843",
      frame: "#25282C",
      detail: "#D57134",
    },
    previewAsset: null,
    updatedAt: Date.now(),
  };

  it("renders palette stage as active when running stage is palette", () => {
    const html = renderToStaticMarkup(
      <GenerationJobSheet run={baseRun} onRetry={() => {}} onReset={() => {}} />
    );
    expect(html).toContain("NPL-0248");
    expect(html).toContain("RUNNING");
    expect(html).toContain("MG Barbatos");
    expect(html).toContain("Eva-Inspired");
    expect(html).toContain("job-stage-item is-running");
    expect(html).toContain("01");
    expect(html).toContain("PALETTE");
    expect(html).toContain("job-scanner-beam");
    expect(html).toContain("#684690");
    expect(html).toContain("#96C843");
    expect(html).toContain("Primary Armor");
    expect(html).toContain("https://cdn.example.test/fullbody.webp");
    expect(html).not.toContain("https://cdn.example.test/cover.webp");
  });

  it("falls back to cover portrait when full-body image is missing", () => {
    const coverOnly: CreationRunRecord = {
      ...baseRun,
      kit: {
        id: "kit-001" as any,
        name: "MG Barbatos",
        grade: "MG",
        scale: "1/100",
        portrait: "https://cdn.example.test/cover.webp",
        fullBody: null,
      },
    };
    const html = renderToStaticMarkup(
      <GenerationJobSheet run={coverOnly} onRetry={() => {}} onReset={() => {}} />
    );
    expect(html).toContain("https://cdn.example.test/cover.webp");
  });

  it("renders mapping stage as active when running stage is specification", () => {
    const specRun: CreationRunRecord = {
      ...baseRun,
      stage: "specification",
    };
    const html = renderToStaticMarkup(
      <GenerationJobSheet run={specRun} onRetry={() => {}} onReset={() => {}} />
    );
    expect(html).toContain("job-stage-item is-completed"); // stage 1 completed
    expect(html).toContain("job-stage-item is-running"); // stage 2 active
  });

  it("renders completion ceremony when status is succeeded", () => {
    const successRun: CreationRunRecord = {
      ...baseRun,
      status: "succeeded",
      stage: "render",
      conceptId: "concept-777" as any,
      previewAsset: {
        publicUrl: "https://r2.neotypelab.com/rendered-barbatos.png",
      },
    };
    const html = renderToStaticMarkup(
      <GenerationJobSheet run={successRun} onRetry={() => {}} onReset={() => {}} />
    );
    expect(html).toContain("✓ REPAINT READY");
    expect(html).toContain("job-result-render-image");
    expect(html).toContain("https://r2.neotypelab.com/rendered-barbatos.png");
    expect(html).toContain("✓ Preview image generated");
    expect(html).toContain("✓ Paint specification locked");
    expect(html).toContain("✓ Real paint references compiled");
    expect(html).toContain("Open in Library →");
    expect(html).toContain("Start another build");
    expect(html).not.toContain("job-scanner-beam");
  });

  it("renders a useful timeout reason and credit refund confirmation without private diagnostics", () => {
    const failedRun: CreationRunRecord = {
      ...baseRun,
      status: "failed",
      stage: "render",
      refunded: true,
      error: "GPU cluster timeout while synthesizing render.",
    };
    const html = renderToStaticMarkup(
      <GenerationJobSheet run={failedRun} onRetry={() => {}} onReset={() => {}} />
    );
    expect(html).toContain("! INTERRUPTED");
    expect(html).toContain("Generation Interrupted");
    expect(html).toContain("Generation took too long to finish. Please try again.");
    expect(html).not.toContain("GPU cluster");
    expect(html).toContain("All 8 credits were returned to your account.");
    expect(html).toContain("Retry preview · 8 credits");
    expect(html).toContain("Return to setup");
    expect(html).toContain("job-stage-item is-failed");
  });

  it("hides a legacy workflow stack while showing a palette recovery message", () => {
    const html = renderToStaticMarkup(<GenerationJobSheet run={{ ...baseRun, status: "failed", refunded: true,
      error: "Error: Uncaught ConvexError: Palette violates color-family for Fiery Orange\n at run (../../node_modules/@convex-dev/workflow/src/client/workflowContext.ts:321:9)" }} onRetry={() => {}} onReset={() => {}} />);
    expect(html).toContain("match the palette to your color requirements");
    expect(html).not.toMatch(/ConvexError|node_modules|workflowContext|Fiery Orange/);
    expect(html).toContain("All 8 credits were returned");
    expect(html).toContain("Retry preview · 8 credits");
  });
  it("shows the user's own photo, not the catalog silhouette, while a Custom Kit repaint builds", () => {
    const html = renderToStaticMarkup(<GenerationJobSheet run={{ ...baseRun, stage: "render",
      kit: { id: "custom-1" as any, name: "RX-93 front", grade: "Custom Kit", scale: "", portrait: null, fullBody: null, referenceObjectId: "reference-object" as any } }}
      onRetry={() => {}} onReset={() => {}} />);
    expect(html).toContain("https://signed.example.test/reference.png");
    expect(html).toContain("Repainting your photo");
    expect(html).toContain("Your upload · private");
    expect(html).not.toContain("Portrait pending");
  });

  it("keeps the uploaded photo in the preview when the repaint is ready", () => {
    const html = renderToStaticMarkup(<GenerationJobSheet run={{ ...baseRun, status: "succeeded", stage: "render",
      previewAsset: { storageObjectId: "render-object" as any },
      kit: { id: "custom-1" as any, name: "RX-93 front", grade: "Custom Kit", scale: "", portrait: null, fullBody: null, referenceObjectId: "reference-object" as any } }}
      onRetry={() => {}} onReset={() => {}} />);
    expect(html).toContain("✓ REPAINT READY");
    expect(html).toContain("https://signed.example.test/reference.png");
    expect(html).toContain("Your photo");
    expect(html).not.toContain("Portrait pending");
  });
});
