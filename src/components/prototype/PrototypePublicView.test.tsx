// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { PrototypePublicView } from "./PrototypePublicView";
import type { PrototypeSnapshot, SharedPrototype } from "./types";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  SignInButton: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("@/src/providers/StartProviders", () => ({
  useStartProviderStatus: () => ({
    hasClerkProvider: false,
    hasConvexAuthBridge: false,
    hasConvexClient: false,
  }),
}));

const concept = {
  indexable: true,
  visualPalette: {
    entries: [
      { roleSlug: "primary-armor", roleName: "Primary Armor", targetHex: "#4A2A6A", recommendedArea: "Torso" },
      { roleSlug: "accent", roleName: "Accent", targetHex: "#6DFF4A" },
    ],
  },
  _id: "concept-1",
  _creationTime: 0,
  recordNumber: 2,
  title: "Barbatos / EVA-inspired",
  notes: null,
  visibility: "public",
  status: "generated",
  moodTags: [],
  weatheringLevel: "clean",
  owner: { handle: "yinglian", fullName: "Yinglian" },
  baseModel: { name: "MG Barbatos", grade: "MG" },
  stylePreset: { name: "EVA-inspired", slug: "eva", isFeaturedStyle: false },
  materialPreset: { name: "Semi-gloss Armor", slug: "semi-gloss", finishType: "semi-gloss" },
  previewAsset: { publicUrl: "https://example.test/preview.jpg", key: "preview.jpg" },
  sourceConcept: null,
  lineage: [],
  remixes: [],
  remixCount: 0,
  engagement: { likeCount: 0, saveCount: 0, viewerHasLiked: false, viewerHasSaved: false },
  paintPlan: {
    conceptTitle: "Barbatos / EVA-inspired",
    stylePresetName: "EVA-inspired",
    sprayNotes: ["Begin by prepping the inner frame.", "Apply a smooth white primer."],
    entries: [
      {
        roleSlug: "primary-armor",
        roleName: "Primary Armor",
        recommendedArea: "Torso / shoulders",
        rationale: "Deep purple establishes the EVA-inspired base. Extra generated filler should be cut.",
        suggestedPaint: {
          brand: "GSI Creos",
          code: "C67",
          colorName: "Purple",
          line: "Mr. Color",
          hexPreview: "#4A2A6A",
        },
      },
      {
        roleSlug: "accent",
        roleName: "Accent",
        recommendedArea: "Eyes",
        rationale: "Neon green reads as an EVA accent.",
        suggestedPaint: {
          brand: "GSI Creos",
          code: "C207",
          colorName: "Fluorescent Green",
          line: "Mr. Color",
          hexPreview: "#6DFF4A",
        },
      },
    ],
  },
} as unknown as SharedPrototype;

const snapshot: PrototypeSnapshot = {
  status: "ok",
  concept,
  generatedAt: "2026-09-17T00:00:00.000Z",
  meta: {
    title: "Barbatos / EVA-inspired | NeotypeLab",
    description: "MG Barbatos / EVA-inspired / Semi-gloss Armor",
    canonicalPath: "/prototype/concept-1",
  },
  structuredData: {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: "Barbatos / EVA-inspired",
    description: "MG Barbatos / EVA-inspired / Semi-gloss Armor",
    url: "https://neotypelab.test/prototype/concept-1",
    image: undefined,
    author: { "@type": "Person", name: "Yinglian", url: undefined, identifier: undefined },
    keywords: "",
    genre: "prototype",
    interactionStatistic: [],
    additionalProperty: [],
  },
};

describe("PrototypePublicView", () => {
  it("stages the public case as artwork, color DNA, and a single create peak", () => {
    const html = renderToStaticMarkup(
      <PrototypePublicView conceptId="concept-1" snapshot={snapshot} />
    );

    expect(html).toContain("Barbatos");
    expect(html).toContain("EVA-inspired");
    expect(html).toContain("MG Barbatos");
    expect(html).toContain("case-artwork");
    expect(html).toContain("case-palette__bars");
    expect(html).toContain("#4A2A6A");
    expect(html).toContain("Color System");
    expect(html).toContain("Technical Color Plan");
    expect(html).toContain("Deep purple establishes the EVA-inspired base");
    expect(html).not.toContain("Extra generated filler should be cut");
    expect(html).toContain("Create your case");
    expect(html).toContain("/create?remix=concept-1");
    expect(html).not.toContain("Remix in Create");
    expect(html).not.toContain("Adjacent Paths");
    expect(html).not.toContain("The case");
    expect(html).not.toContain("Search this paint");
  });
});
