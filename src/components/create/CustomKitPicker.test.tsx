// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { readFileSync, writeFileSync } from "node:fs";
import { CustomKitPicker } from "./CustomKitPicker";
import type { Id } from "@/convex/_generated/dataModel";

let enabled = true;
let confirmed = false;
let blocked = false;
const snapshot = { observations: { reason: "Visible original mecha structure.", parts: [{ id: "shoulders", name: "Shoulder armor", description: "Layered mechanical shoulder shells.", visibility: "visible" }], uncertainFeatures: ["Back attachment is not visible."] }, corrections: [], requestedEdits: [] };
vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useMutation: () => vi.fn(), useQuery: (ref: Parameters<typeof getFunctionName>[0], args?: unknown) => {
  const name = getFunctionName(ref);
  if (args === "skip") return undefined;
  if (name === "customKits:availability") return { enabled, scanCost: 1 };
  if (name === "customKits:mine") return [{ id: "custom", name: "Original Mecha" }];
  if (name === "customKits:get") return blocked
    ? { id: "custom", name: "Original Mecha", versionId: null, snapshotJson: null, confirmed: false, scanStatus: "succeeded", blocked, scanResultJson: JSON.stringify({ reason: "This image can't be used under the AI Acceptable Use Policy." }) }
    : { id: "custom", name: "Original Mecha", versionId: "version-1", snapshotJson: JSON.stringify(snapshot), confirmed, scanStatus: "succeeded", blocked };
  return null;
} }));
vi.mock("@/src/hooks/usePrivateAssetUrl", () => ({ usePrivateAssetUrl: () => null }));
describe("Custom Kit structure confirmation", () => {
  it("separates correction, modification and uncertain observations without requiring a known IP", () => {
    enabled = true; confirmed = false;
    const html = renderToStaticMarkup(<CustomKitPicker selectedId={"custom" as Id<"customKits">} disabled={false} onChange={() => {}} />);
    expect(html).toContain("Use these parts");
    expect(html).toContain("We found 1 part");
    expect(html).toContain("Fully visible");
    expect(html).not.toContain("shoulders ·");
    expect(html).toContain("Fix this description");
    expect(html).toContain("Change the shape (optional)");
    expect(html).toContain("Not visible in this photo");
    expect(html).toContain("They aren’t in your paint plan");
    expect(html).toContain("Private · only you see this");
    expect(html).toContain("Back attachment is not visible.");
    expect(html).not.toContain("second reference");
    if (process.env.CUSTOM_KIT_VISUAL_QA) {
      const css = ["tokens.css", "globals.css", "create-workspace.css"].map(file => readFileSync(`src/styles/${file}`, "utf8")).join("\n");
      writeFileSync("/tmp/neotypelab-custom-kit-qa.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--color-paper);font-family:var(--font-body);color:var(--color-ink)}button,input,textarea,select{font:inherit}input,textarea{width:100%;border:1px solid var(--color-rule);background:var(--color-paper-2);padding:.7rem}button{padding:.7rem;border:1px solid var(--color-rule);background:transparent}main{max-width:760px;margin:auto} ${css}</style><main class="create-workspace">${html}</main></html>`);
    }
  });
  it("leads an empty Custom Kit with the drop zone and an optional name", () => {
    enabled = true;
    const html = renderToStaticMarkup(<CustomKitPicker selectedId={null} disabled={false} onChange={() => {}} />);
    expect(html).toContain("Drop a photo of your kit here");
    expect(html).toContain('type="file"');
    expect(html).toContain("We’ll use the file name if you leave this empty");
    expect(html).toContain("animal-shaped robots are welcome");
    expect(html).toContain("A straight front view works best");
    expect(html).toContain('aria-current="step">');
    expect(html).not.toContain("Replace photo");
  });
  it("explains a policy block and returns to a fresh upload without showing the reference", () => {
    enabled = true; blocked = true;
    const html = renderToStaticMarkup(<CustomKitPicker selectedId={"custom" as Id<"customKits">} disabled={false} onChange={() => {}} />);
    blocked = false;
    expect(html).toContain("We can’t use this image.");
    expect(html).toContain("Drop a photo of your kit here");
    expect(html).not.toContain("Check parts ·");
    expect(html).not.toContain("private reference\"");
  });
  it("keeps paid actions closed before the verified deployment flag is enabled", () => {
    enabled = false;
    const html = renderToStaticMarkup(<CustomKitPicker selectedId={null} disabled={false} onChange={() => {}} />);
    expect(html).toContain("Uploading your own kit is coming soon");
    expect(html).not.toContain('type="file"');
  });
});
