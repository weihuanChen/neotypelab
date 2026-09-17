// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationJobSheet, type CreationRunRecord } from "./GenerationJobSheet";

vi.mock("@/src/hooks/usePrivateAssetUrl", () => ({ usePrivateAssetUrl: () => null }));
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
      portrait: null,
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

  it("renders diagnostic failure state and credit refund confirmation when status is failed", () => {
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
    expect(html).toContain("GPU cluster timeout while synthesizing render.");
    expect(html).toContain("All 8 credits were returned to your account.");
    expect(html).toContain("Retry preview · 8 credits");
    expect(html).toContain("Return to setup");
    expect(html).toContain("job-stage-item is-failed");
  });
});
