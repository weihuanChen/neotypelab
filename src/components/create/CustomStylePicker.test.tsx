// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { StyleJobExisting } from "./CustomStylePicker";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

describe("StyleJobExisting", () => {
  it("offers a fresh style alongside revising a found direction", () => {
    const html = renderToStaticMarkup(
      <StyleJobExisting
        busy={false}
        creditBalance={10}
        creditCost={2}
        direction="Jungle camo"
        match={{ interpretation: null, style: { id: "style-1", name: "Jungle Ranger" }, records: [] }}
        onFormAgain={() => undefined}
        onNewStyle={() => undefined}
        onRevise={() => undefined}
        onUseExisting={() => undefined}
      />
    );

    expect(html).toContain("Custom Style / Exists");
    expect(html).toContain("Revise direction");
    expect(html).toContain("New style");
    expect(html).toContain("Form again · 2 credits");
  });
});
