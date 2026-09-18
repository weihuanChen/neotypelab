// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { SystemState } from "./SystemState";
import { SystemSignal } from "./SystemSignal";
import { systemStates } from "./systemStatePresets";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

describe("SystemState", () => {
  it("renders the 404 archive language without a card shell", () => {
    const html = renderToStaticMarkup(
      <SystemState
        {...systemStates.notFound}
        layout="page"
        primary={<a href="/">Return home ←</a>}
        secondary={<a href="/showcase">Explore public cases ↗</a>}
      />
    );

    expect(html).toContain("404");
    expect(html).toContain("Route archive / N°404");
    expect(html).toContain("Route\nnot found");
    expect(html).toContain("Route / Missing");
    expect(html).toContain("Return home");
    expect(html).toContain("Explore public cases");
    expect(html).toContain("system-state--page");
    expect(html).not.toContain("library-empty");
    expect(html).not.toContain("spike-panel");
    expect(html).not.toContain("spike-button");
  });

  it("keeps auth as an access state with a locked signal", () => {
    const html = renderToStaticMarkup(
      <SystemState
        {...systemStates.authWorkspace}
        primary={<button type="button">Sign in →</button>}
      />
    );

    expect(html).toContain("AUTH");
    expect(html).toContain("Your workspace\nis private.");
    expect(html).toContain("Access / Locked");
    expect(html).toContain("is-access");
    expect(html).not.toContain("ERROR / LOGIN REQUIRED");
  });

  it("teaches the first library record as onboarding, not an error", () => {
    const html = renderToStaticMarkup(
      <SystemState
        {...systemStates.emptyLibrary}
        primary={<a href="/create">Create first prototype →</a>}
      />
    );

    expect(html).toContain("000");
    expect(html).toContain("Your archive\nstarts here.");
    expect(html).toContain("Choose a kit");
    expect(html).toContain("Define a direction");
    expect(html).toContain("Generate your prototype");
    expect(html).toContain("is-onboarding");
    expect(html).toContain("Archive / Empty");
  });

  it("uses a traveling node for session sync", () => {
    const html = renderToStaticMarkup(<SystemSignal kind="loading" label="System / Sync" />);
    expect(html).toContain("system-signal is-loading");
    expect(html).toContain("system-signal__node");
    expect(html).toContain("System / Sync");
  });

  it("keeps public archive loading as a progress state", () => {
    const html = renderToStaticMarkup(<SystemState {...systemStates.exploreLoading} />);
    expect(html).toContain("Explore / Indexing");
    expect(html).toContain("Opening");
    expect(html).toContain("the public archive.");
    expect(html).toContain("is-progress");
    expect(html).toContain("Archive / Sync");
  });
});
