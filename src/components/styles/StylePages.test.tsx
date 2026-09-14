// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { readFileSync, writeFileSync } from "node:fs";
import { CommunityStyleGallery, CommunityStyleDetail } from "./CommunityStylePages";
import { StyleGallery, StyleDetail, StyleModelDetail } from "./StylePages";
import type { Id } from "@/convex/_generated/dataModel";

vi.mock("@/src/components/app-shell/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/site", () => ({ absoluteUrl: (path: string) => `https://neotypelab.test${path}` }));

const imageUrl = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="900"><rect width="800" height="900" fill="#d7d5ce"/><path d="M280 170h240l80 140-55 300-145 80-145-80-55-300z" fill="#187e83"/><path d="M315 280h170v200H315z" fill="#263337"/><path d="M275 515h250v30H275z" fill="#b74067"/><text x="400" y="790" font-size="24" text-anchor="middle" fill="#263337">LAYOUT TEST FIXTURE</text></svg>');
const style = {
  id: "style" as Id<"stylePresets">, name: "Cyan Digital", slug: "cyan-digital", category: "Digital", featured: true,
  description: "Cyan armor, a dark frame and restrained racing graphics.",
  intent: {
    version: "style-intent.v1" as const, source: "official" as const, styleType: "preset" as const, name: "Cyan Digital",
    palette: { primary: "Cyan teal", secondary: "Charcoal", accent: "Magenta" },
    surfaceLogic: "Smooth", graphicLanguage: "Racing / digital", contrast: "high" as const,
    markingDensity: "medium" as const, materialIntent: ["Painted armor"], mood: "Energetic",
    weathering: "clean" as const, finish: "satin" as const, paintability: "high" as const,
  },
};
const pair = {
  style, imageUrl, model: { id: "model" as Id<"baseModels">, name: "RX-78-2", slug: "rx-78-2", scale: "1/100", grade: "MG" },
  conceptId: "concept" as Id<"concepts">, reviewedAt: 1,
  palette: { entries: [{ roleName: "Primary armor", roleSlug: "primary", rationale: "Target #00AABB; closest catalog sample ΔE00 2.1.",
    suggestedPaint: { _id: "paint", brand: "Catalog fixture", code: "TEST-01", colorName: "Cyan teal", hexPreview: "#008E94" } }] },
};

describe("style editorial pages", () => {
  it("renders style-first links, kit application and actual mapped paint values", () => {
    const gallery = renderToStaticMarkup(<StyleGallery styles={[{ ...style, imageUrl, modelCount: 1, reviewedAt: 1 }]} />);
    const detail = renderToStaticMarkup(<StyleDetail detail={{ style, pairs: [pair] }} />);
    const model = renderToStaticMarkup(<StyleModelDetail pair={pair} />);
    expect(gallery).toContain('href="/styles/cyan-digital"');
    expect(detail).toContain('href="/styles/cyan-digital/rx-78-2"');
    expect(model).toContain("recommendedStyle=cyan-digital");
    expect(model).toContain("recommendedBaseModel=rx-78-2");
    expect(model).toContain("TEST-01");
    expect(model).toContain("ΔE00 2.1");
    if (process.env.STYLE_VISUAL_QA) {
      const css = ["tokens.css", "styles.css"].map(file => readFileSync(`src/styles/${file}`, "utf8")).join("\n");
      for (const [name, html] of Object.entries({ gallery, detail, model })) {
        writeFileSync(`/tmp/neotypelab-style-${name}.html`,
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:var(--color-paper);font-family:var(--font-body)}a{color:inherit;text-decoration:none}button{font:inherit;cursor:pointer;background:transparent}.showcase-button{display:inline-block;padding:12px 18px;border:1px solid currentColor} ${css}</style>${html}</html>`);
      }
    }
  });
  it("renders community directions without inventing previews or linking them to official SEO pages", () => {
    const shared = {
      id: "shared-style" as Id<"userStyles">, name: "Cyan Performance",
      intent: { ...style.intent, source: "community" as const, styleType: "custom" as const },
      creator: { name: "Test creator", handle: "test-creator" }, saveCount: 2,
      publicPrototypeCount: 0, preview: null, promoted: false, createdAt: 1,
    };
    const gallery = renderToStaticMarkup(<CommunityStyleGallery styles={[shared]} />);
    const detail = renderToStaticMarkup(<CommunityStyleDetail style={shared} />);
    expect(gallery).toContain('href="/c/shared-style"');
    expect(detail).toContain('href="/create?communityStyle=shared-style"');
    expect(gallery).toContain("Palette study");
    expect(gallery).not.toContain("<img");
    expect(detail).not.toContain('application/ld+json');
    if (process.env.STYLE_VISUAL_QA) {
      const css = ["tokens.css", "styles.css"].map(file => readFileSync(`src/styles/${file}`, "utf8")).join("\n");
      for (const [name, html] of Object.entries({ gallery, detail })) {
        writeFileSync(`/tmp/neotypelab-community-${name}.html`,
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:var(--color-paper);font-family:var(--font-body)}a{color:inherit;text-decoration:none}.mt-8{margin-top:32px}.showcase-button{display:inline-block;padding:12px 18px;border:1px solid currentColor}${css}</style>${html}</html>`);
      }
    }
  });

  it("escapes style data embedded in JSON-LD", () => {
    const malicious = "</script><script>alert(1)</script>";
    const html = renderToStaticMarkup(<StyleDetail detail={{ style: { ...style, description: malicious }, pairs: [pair] }} />);
    expect(html).not.toContain(malicious);
    expect(html).toContain("\\u003c/script");
  });
});
