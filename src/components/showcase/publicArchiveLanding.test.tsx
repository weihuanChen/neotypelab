// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { ExploreLanding } from "./ExploreLanding";
import { ShowcaseLanding } from "./ShowcaseLanding";
import type { ShowcaseConcept, ShowcaseSnapshot } from "./types";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    href,
    to,
    ...props
  }: { children: ReactNode; href?: string; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/src/providers/StartProviders", () => ({
  useStartProviderStatus: () => ({
    hasClerkProvider: true,
    hasConvexAuthBridge: true,
    hasConvexClient: true,
  }),
}));

const emptySnapshot: ShowcaseSnapshot = {
  status: "ok",
  generatedAt: "2026-09-18T00:00:00.000Z",
  concepts: [],
  creatorPacks: [],
  rankedCreators: [],
};

const concept = {
  _id: "concept-1",
  _creationTime: Date.UTC(2026, 7, 16),
  title: "Field Hazard",
  visibility: "public",
  status: "generated",
  moodTags: [],
  weatheringLevel: "heavy",
  owner: { handle: "yinglian", fullName: "Yinglian" },
  baseModel: { name: "MG Gundam MK–II", slug: "mg-gundam-mk-ii" },
  stylePreset: {
    name: "Industrial Hazard",
    slug: "industrial-hazard",
    category: "industrial",
    isFeaturedStyle: false,
  },
  materialPreset: { name: "Chipped Enamel", slug: "chipped-enamel", finishType: "matte" },
  previewAsset: { publicUrl: "https://cdn.test/preview.webp" },
  remixCount: 4,
  engagement: {
    saveCount: 8,
    likeCount: 2,
    viewerHasLiked: false,
    viewerHasSaved: false,
  },
} as unknown as ShowcaseConcept;

describe("ExploreLanding", () => {
  it("shows SystemState while the public archive is still opening", () => {
    useQueryMock.mockReturnValue(undefined);
    const html = renderToStaticMarkup(<ExploreLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("Explore / Indexing");
    expect(html).toContain("the public archive.");
    expect(html).not.toContain("Today");
    expect(html).not.toContain("/assets/explore/");
  });

  it("shows the empty archive instead of editorial placeholders", () => {
    useQueryMock.mockReturnValue([]);
    const html = renderToStaticMarkup(<ExploreLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("No paint plans");
    expect(html).toContain("Plan a paint scheme");
    expect(html).not.toContain("Gundam MK");
    expect(html).not.toContain("/assets/explore/");
  });

  it("renders live concepts once the archive resolves", () => {
    useQueryMock.mockReturnValue([concept]);
    const html = renderToStaticMarkup(<ExploreLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("Field Hazard");
    expect(html).toContain("https://cdn.test/preview.webp");
    expect(html).not.toContain("/assets/explore/");
  });
});

describe("ShowcaseLanding", () => {
  it("shows SystemState while the public archive is still opening", () => {
    useQueryMock.mockReturnValue(undefined);
    const html = renderToStaticMarkup(<ShowcaseLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("Showcase / Indexing");
    expect(html).toContain("the public archive.");
    expect(html).not.toContain("Crimson Command");
    expect(html).not.toContain("/assets/explore/");
  });

  it("shows the empty archive instead of editorial placeholders", () => {
    useQueryMock.mockReturnValue([]);
    const html = renderToStaticMarkup(<ShowcaseLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("No paint plans");
    expect(html).toContain("Explore works");
    expect(html).not.toContain("Crimson Command");
    expect(html).not.toContain("/assets/explore/");
  });

  it("renders live works once the archive resolves", () => {
    useQueryMock.mockReturnValue([concept]);
    const html = renderToStaticMarkup(<ShowcaseLanding search={{}} snapshot={emptySnapshot} />);

    expect(html).toContain("Field Hazard");
    expect(html).toContain("Selected works");
    expect(html).toContain("https://cdn.test/preview.webp");
    expect(html).not.toContain("/assets/explore/");
  });
});
