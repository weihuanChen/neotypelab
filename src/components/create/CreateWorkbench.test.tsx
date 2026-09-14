// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { readFileSync, writeFileSync } from "node:fs";
import { CreateWorkbench } from "./CreateWorkbench";

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
    return null;
  },
}));
vi.mock("@/src/hooks/usePrivateAssetUrl", () => ({ usePrivateAssetUrl: () => null }));

describe("Create step navigation", () => {
  it("opens with styles and gates model selection behind a selected style", () => {
    const html = renderToStaticMarkup(<CreateWorkbench />);
    expect(html).toContain('aria-label="Creation steps"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Choose a style");
    expect(html).toContain("Crimson Command");
    expect(html).toMatch(/disabled=""[^>]*>02/);
    expect(html).toContain('hidden=""');
    expect(html.indexOf("Choose a style")).toBeLessThan(html.indexOf("Apply to a model</h"));
    expect(html).not.toContain('step="03"');
    if (process.env.CREATE_VISUAL_QA) {
      const css = ["tokens.css", "workbench.css"].map(file => readFileSync("src/styles/" + file, "utf8")).join("\n");
      writeFileSync("/tmp/neotypelab-create-step1.html", `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--color-paper);font-family:var(--font-body)}button{font:inherit;color:inherit;background:transparent} ${css}</style>${html}</html>`);
    }
  });
});
