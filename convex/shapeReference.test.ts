import { describe, expect, it } from "vitest";
import { cloudflareImageRequest } from "./llmProtocol";
import {
  loadShapeReferenceDataUri,
  referenceContentType,
  supportsShapeReference,
  withShapeReferenceDirective,
} from "./shapeReference";

describe("shape reference", () => {
  it("only attaches to protocols that accept input images", () => {
    expect(supportsShapeReference("cloudflare-ai-run")).toBe(true);
    expect(supportsShapeReference("openai-chat-completions")).toBe(true);
    expect(supportsShapeReference("openai-compatible")).toBe(false);
  });

  it("prefixes a geometry-only directive", () => {
    const prompt = withShapeReferenceDirective("Render the kit.");
    expect(prompt.startsWith("SHAPE REFERENCE")).toBe(true);
    expect(prompt).toContain("never line art");
    expect(prompt.endsWith("Render the kit.")).toBe(true);
  });

  it("adds images to Cloudflare requests only when present", () => {
    const base = { modelId: "openai/gpt-image-2.5-sunburst", prompt: "p", quality: "high" };
    expect("images" in cloudflareImageRequest(base).input).toBe(false);
    expect(cloudflareImageRequest({ ...base, images: ["data:image/png;base64,AA=="] }).input.images)
      .toEqual(["data:image/png;base64,AA=="]);
  });

  it("infers content types from headers or extensions", () => {
    expect(referenceContentType("image/webp", "https://x/a")).toBe("image/webp");
    expect(referenceContentType("application/octet-stream", "https://x/a.PNG?v=1")).toBe("image/png");
    expect(referenceContentType(null, "https://x/a.gif")).toBeNull();
  });

  it("loads a data URI and degrades to null on failure", async () => {
    const ok = (async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
    expect(await loadShapeReferenceDataUri("https://x/a.png", ok)).toBe("data:image/png;base64,AQID");
    const missing = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    expect(await loadShapeReferenceDataUri("https://x/a.png", missing)).toBeNull();
    const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await loadShapeReferenceDataUri("https://x/a.png", broken)).toBeNull();
  });

  it("reads emblems from the line art instead of a fixed list", () => {
    const prompt = withShapeReferenceDirective("Render the kit.");
    expect(prompt).toContain("Any emblem, insignia, symbol, or engraved mark drawn in the reference is molded kit design");
    expect(prompt).toContain("never replace it with style, faction, or unit insignia");
  });
});
