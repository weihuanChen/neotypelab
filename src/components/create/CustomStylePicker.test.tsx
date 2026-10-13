// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { StyleJobExisting } from "./CustomStylePicker";
import type { DirectionMatch } from "@/convex/styleInterpretations";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

describe("StyleJobExisting", () => {
  const render = (records: DirectionMatch["records"]) => renderToStaticMarkup(
    <StyleJobExisting
      busy={false}
      direction="Jungle camo"
      match={{ interpretation: null, style: { id: "style-1", name: "Jungle Ranger" }, records }}
      onNewStyle={() => undefined}
      onUse={() => undefined}
    />
  );

  it("offers only use, last result and a fresh style", () => {
    const html = render([{ conceptId: "concept-2", recordNumber: 12, title: "Latest", kitName: "Zaku", status: "generated" }, { conceptId: "concept-1", recordNumber: 11, title: "Older", kitName: "Zaku", status: "generated" }]);
    expect(html).toContain("Use this style");
    expect(html).toContain("Free");
    expect(html).toContain("View last result");
    expect(html).toContain('href="/library/$conceptId"');
    expect(html).toContain("used it in 2 builds");
    expect(html).toContain("New style");
    expect(html).not.toContain("Form again");
    expect(html).not.toContain("Revise direction");
    expect(html).not.toContain("Older");
  });

  it("hides the last result when the style was never used in a build", () => {
    const html = render([]);
    expect(html).toContain("Use this style");
    expect(html).not.toContain("View last result");
  });
});
