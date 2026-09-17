// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { LibraryDetailPage, type WorkDetail } from "./LibraryDetailPage";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: () => mockDetail,
  AuthLoading: () => null,
  Unauthenticated: () => null,
  Authenticated: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  SignInButton: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

function paintMatch(roleSlug: string, code: string, colorName: string, hex: string, deltaE00: number) {
  return {
    roleSlug,
    targetHex: hex,
    paintEffect: "solid" as const,
    deltaE00,
    matchBand: deltaE00 <= 2 ? "very_close" as const : deltaE00 <= 4 ? "close" as const : "usable" as const,
    warnings: [],
    paint: {
      brand: "Mr. Color",
      line: "C Series",
      code,
      colorName,
      hexPreview: hex,
      finishType: "lacquer",
    },
  };
}

const mockDetail = {
  id: "concept-1",
  title: "RX-93 ν Gundam / Char’s Counterattack",
  recordNumber: 42,
  createdAt: Date.UTC(2026, 2, 12),
  status: "generated",
  visibility: "private",
  notes: "Keep the psycho-frame cool and the armor planes clean.",
  mood: ["ceremonial", "high-contrast"],
  weathering: "clean",
  kit: { name: "RX-93 ν Gundam", grade: "MG", scale: "1/100", manufacturer: "Bandai" },
  style: "Char’s Counterattack",
  material: "Lacquer armor",
  hero: { storageObjectId: null, publicUrl: null, width: null, height: null, version: 1 },
  collections: [],
  documents: [],
  history: [],
  palette: {
    version: "visual-palette.v2",
    entries: [
      {
        roleSlug: "primary-armor",
        roleName: "Primary Armor",
        targetHex: "#F4F1EA",
        paintEffect: "solid",
        recommendedArea: "Chest outer plates",
        rationale: "Off-white armor body.",
      },
      {
        roleSlug: "secondary-armor",
        roleName: "Secondary Armor",
        targetHex: "#3B2463",
        paintEffect: "solid",
        recommendedArea: "Shoulder armor",
        rationale: "Deep violet contrast.",
      },
      {
        roleSlug: "frame",
        roleName: "Exposed Frame",
        targetHex: "#6E6A62",
        paintEffect: "metallic",
        recommendedArea: "Inner frame",
        rationale: "Gunmetal internals.",
      },
    ],
    sprayNotes: [
      "Prime the inner frame gloss black before the gunmetal pass.",
      "Lay white and grey armor in thin coats to preserve color purity.",
      "Mask and spray flat white and neon green accents last among color coats.",
      "Hit sensors with bright silver, then a drop of clear red.",
      "Seal with a unified semi-gloss topcoat.",
    ],
  },
  paintRecommendations: {
    version: "paint-recommendations.v1",
    generatedAt: Date.UTC(2026, 2, 12),
    sets: [
      {
        id: "mr-color:c-series",
        brand: "Mr. Color",
        line: "C Series",
        label: "Mr. Color C Series",
        recommended: true,
        coverageCount: 6,
        roleCount: 6,
        averageDeltaE: 2.4,
        maxDeltaE: 5.9,
        missingRoleSlugs: [],
        warnings: [],
        entries: [
          paintMatch("primary-armor", "C69", "Off White", "#F4F1EA", 1.8),
          paintMatch("secondary-armor", "C67", "Purple", "#3B2463", 5.9),
          paintMatch("frame", "C28", "Steel", "#6E6A62", 3.1),
        ],
      },
      {
        id: "tamiya:acrylic",
        brand: "Tamiya",
        line: "Acrylic",
        label: "Tamiya Acrylic",
        recommended: false,
        coverageCount: 6,
        roleCount: 6,
        averageDeltaE: 3.2,
        maxDeltaE: 6.4,
        missingRoleSlugs: [],
        warnings: [],
        entries: [
          paintMatch("primary-armor", "XF-2", "Flat White", "#F4F1EA", 2.2),
          paintMatch("secondary-armor", "X-16", "Purple", "#3B2463", 6.4),
          paintMatch("frame", "X-10", "Gun Metal", "#6E6A62", 3.4),
        ],
      },
    ],
  },
  specification: {
    summary: "Separate the white armor from the violet accents before any metallic frame work.",
    panels: [
      {
        roleSlug: "primary-armor",
        areas: ["Chest outer plates", "Shoulder armor", "Forearm guards", "Thigh armor", "Shin armor", "Head crown"],
        maskingNotes: "Mask off the main outer armor before the violet pass.",
      },
      {
        roleSlug: "secondary-armor",
        areas: ["Collar", "Skirt binders", "Funnel racks", "Knee caps", "Ankle guards"],
        maskingNotes: "Apply to secondary armor after the white base has cured.",
      },
      {
        roleSlug: "frame",
        areas: ["Exposed Gundam frame", "Thruster bells", "Joint covers"],
        maskingNotes: "Disassemble the inner frame and spray separately.",
      },
    ],
    material: {
      surfaceTexture: "Smooth semi-gloss outer armor. Metallic exposed frame.",
      reflectivity: "Medium / High metallic frame",
      coating: "Semi-gloss armor. Gloss metallic components.",
    },
    weathering: {
      level: "clean",
      applicationNotes: "None",
    },
    decals: {
      density: "low",
      placementNotes: "Restrained orange caution markings on the chest and binders.",
    },
  },
} as unknown as WorkDetail;

describe("LibraryDetailPage overview language", () => {
  it("renders a matrix, editorial process columns, and a spray timeline instead of nested cards", () => {
    const html = renderToStaticMarkup(
      <LibraryDetailPage conceptId="concept-1" tab="overview" onTabChange={() => undefined} />
    );

    expect(html).toContain("work-detail-matrix");
    expect(html).toContain("Chest outer plates · Shoulder armor · Forearm guards");
    expect(html).not.toContain("work-detail-matrix__area-tag");

    expect(html).toContain("work-detail-system-switch");
    expect(html).toContain("Mr. Color C Series");
    expect(html).toContain("6 / 6");

    expect(html).toContain("work-detail-process");
    expect(html).toContain("Panel Masking");
    expect(html).toContain("Surface &amp; Finish");
    expect(html).toContain("Decals &amp; Weathering");
    expect(html).toContain("is-high");
    expect(html).toContain("14 zones");
    expect(html).not.toContain("work-detail-step-card");

    expect(html).toContain("work-detail-sequence");
    expect(html).toContain("Prime the inner frame gloss black");
    expect(html).not.toContain("work-detail-spray-card");
    expect(html).not.toContain("PHASE 01");

    expect(html).toContain("ΔE 5.9");
    expect(html).toContain("solid target");
    expect(html).toContain("Publish to Showcase");
    expect(html).toContain("Share this prototype to Showcase");
    expect(html).toContain("work-detail-print-colophon");
    expect(html).toContain("neotypelab.com");
  });

  it("shows an Open Showcase control when the work is already public", () => {
    mockDetail.visibility = "public";
    const html = renderToStaticMarkup(
      <LibraryDetailPage conceptId="concept-1" tab="overview" onTabChange={() => undefined} />
    );
    expect(html).toContain("Open Showcase");
    expect(html).toContain("This build is live on the hangar wall.");
    mockDetail.visibility = "private";
  });
});
