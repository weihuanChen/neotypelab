// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { HomeLanding, shortNote } from "./HomeLanding";
import { buildHomeStructuredData, homeFaq, HOME_FAQ_OPEN_COUNT, starterBuildsLabel } from "./homeContent";
import { legacyArchiveRedirect } from "@/src/lib/homeRouteData";
import type { HomeData } from "./types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

const hero = {
  conceptId: "concept-1",
  title: "Navy Command study",
  href: "/prototype/concept-1",
  kitName: "RX-78-2 Gundam",
  styleName: "Navy Command",
  creator: "yinglian",
  imageUrl: "https://cdn.test/master.webp",
  lineArtUrl: "https://cdn.test/lineart.webp",
  showLineArt: true,
  paints: [
    { letter: "A", name: "Off white", roleName: "Armor base", hex: "#D8D5CC", area: "Outer armor", coverage: 60, paint: { brand: "Mr. Color", code: "C1", colorName: "White" } },
    { letter: "B", name: "Hazard orange", roleName: "Accent", hex: "#C25F2A", area: null, coverage: 40, paint: null },
  ],
  callouts: [{ letter: "B", paintIndex: 1, x: 0.3, y: 0.4 }],
  sprayNotes: ["Prime all parts in grey. Let it cure overnight.", "Spray the armor base."],
} as unknown as NonNullable<HomeData["hero"]>;

const work = {
  conceptId: "concept-2", title: "Field Hazard", href: "/prototype/concept-2",
  kitName: "Jegan", styleName: "Teal field service", creator: "kei", imageUrl: "https://cdn.test/w.webp",
} as unknown as HomeData["works"][number];

describe("HomeLanding", () => {
  it("states what the site does and leads to Create even with no data", () => {
    const html = renderToStaticMarkup(<HomeLanding data={null} />);
    expect(html).toContain("Plan your Gunpla paint scheme before you spray.");
    expect(html).toContain('href="/create"');
    expect(html).toContain("What a plan gives you");
    expect(html).toContain("Questions before you start");
    expect(html).not.toContain("home-carousel");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(starterBuildsLabel);
  });

  it("renders the curated build, its paint key and the carousel", () => {
    const html = renderToStaticMarkup(<HomeLanding data={{ hero, works: [work], curated: { hero: true, works: true } }} />);
    expect(html).toContain("https://cdn.test/lineart.webp");
    expect(html).toContain("Mr. Color C1");
    expect(html).toContain("Mix #C25F2A");
    expect(html).toContain("Hazard orange (custom mix)");
    expect(html).toContain("Prime all parts in grey");
    expect(html).not.toContain("Let it cure overnight");
    expect(html).toContain("Teal field service");
    expect(html).toContain('href="/showcase"');
  });

  it("keeps the catalog kit story unless Custom Kit is enabled", () => {
    const catalog = renderToStaticMarkup(<HomeLanding data={null} />);
    expect(catalog).toContain("Pick your kit");
    expect(catalog).toContain("You pick the exact kit in step two");
    expect(catalog).not.toContain("Bring your model");

    const custom = renderToStaticMarkup(<HomeLanding customKit data={null} />);
    expect(custom).toContain("upload a photo of your model");
    expect(custom).toContain("Bring your model");
    expect(custom).toContain("Start with a photo of your own mecha");
    expect(custom).not.toContain("You pick the exact kit in step two");
    const [, faq] = buildHomeStructuredData(true);
    expect(JSON.stringify(faq)).toContain("Start with a photo of your own mecha");
    expect(JSON.stringify(faq)).not.toContain("{link}");
  });

  it("opens the first FAQ items and keeps the rest folded", () => {
    const html = renderToStaticMarkup(<HomeLanding data={null} />);
    expect(html.match(/<details open="">/g)).toHaveLength(HOME_FAQ_OPEN_COUNT);
    expect(html.match(/<details/g)).toHaveLength(homeFaq.length);
  });
});

describe("home structured data and redirects", () => {
  it("publishes WebSite and FAQPage built from the visible FAQ", () => {
    const [site, faq] = buildHomeStructuredData();
    expect(site["@type"]).toBe("WebSite");
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(homeFaq.length);
    expect(JSON.stringify(faq)).not.toContain("{link}");
  });

  it("sends old Explore filter links to the Showcase archive", () => {
    expect(legacyArchiveRedirect({})).toBeNull();
    expect(legacyArchiveRedirect({ style: "navy", sort: "recent", utm_source: "x" }))
      .toBe("/showcase/archive?sort=recent&style=navy");
  });

  it("shortens spray notes to their first clause", () => {
    expect(shortNote("Mask the chest block; spray navy.")).toBe("Mask the chest block");
  });
});
