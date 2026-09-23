// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { readFileSync, writeFileSync } from "node:fs";
import { CreateWorkbench } from "./CreateWorkbench";

let mockLatestRun: any = null;

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "catalog:listCreateOptions") return {
      kitVariants: [], baseModels: [], materialPresets: [], colorRoles: [], priceRules: [],
      stylePresets: [{ _id: "style", name: "Crimson Command", slug: "crimson-command", category: "Command",
        shortDescription: "Deep crimson with restrained mechanical markings." }],
    };
    if (name === "users:viewer") return { _id: "viewer", creditBalance: 10 };
    if (name === "styleEditorial:gallery") return [];
    if (name === "creationRuns:latest") return mockLatestRun;
    return null;
  },
}));
vi.mock("@/src/hooks/usePrivateAssetUrl", () => ({ usePrivateAssetUrl: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>,
}));

describe("Create step navigation", () => {
  it("opens with styles and gates model selection behind a selected style", () => {
    mockLatestRun = null;
    const html = renderToStaticMarkup(<CreateWorkbench />);
    expect(html).toContain('aria-label="Creation steps"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Choose a color direction.");
    expect(html).toContain("Crimson Command");
    expect(html).toMatch(/disabled=""[^>]*>02/);
    expect(html).toContain('hidden=""');
    expect(html).not.toContain('aria-label="Search kits"');
    expect(html).not.toContain("Create repaint specification");
    expect(html).not.toContain("palette 1 + specification");
    expect(html).not.toContain('step="03"');
    if (process.env.CREATE_VISUAL_QA) {
      const css = ["tokens.css", "workbench.css"].map(file => readFileSync("src/styles/" + file, "utf8")).join("\n");
      writeFileSync("/tmp/neotypelab-create-step1.html", `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--color-paper);font-family:var(--font-body)}button{font:inherit;color:inherit;background:transparent} ${css}</style>${html}</html>`);
    }
  });

  it("switches to GenerationJobSheet when a preview generation is running", () => {
    mockLatestRun = {
      id: "run-001",
      jobId: "NPL-2841",
      status: "running",
      stage: "render",
      cost: 8,
      refunded: false,
      title: "MG Barbatos × Crimson Command",
      kit: {
        id: "kit-1",
        name: "MG Barbatos",
        grade: "MG",
        scale: "1/100",
        portrait: null,
      },
      styleName: "Crimson Command",
      styleSlug: "crimson-command",
      visualPalette: {
        primary: "#A51F25",
        accent: "#C49A45",
        frame: "#191919",
      },
      previewAsset: null,
      updatedAt: Date.now(),
    };

    const html = renderToStaticMarkup(<CreateWorkbench />);
    expect(html).toContain("NPL-2841");
    expect(html).toContain("RUNNING");
    expect(html).toContain("MG Barbatos");
    expect(html).toContain("Crimson Command");
    expect(html).toContain("01");
    expect(html).toContain("PALETTE");
    expect(html).toContain("02");
    expect(html).toContain("MAPPING");
    expect(html).toContain("03");
    expect(html).toContain("RENDER");
    expect(html).toContain("04");
    expect(html).toContain("PAINT PLAN");
    expect(html).toContain("job-scanner-beam");
    expect(html).toContain("This build will continue in the background if you leave this page.");
    expect(html).not.toContain("Choose a color direction.");
  });
});
