// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { JobResult } from "./JobResult";
import { JobWait } from "./JobWait";
import { jobWaitProfiles } from "./jobWaitProfiles";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string } & Record<string, unknown>) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>{children}</a>
  ),
}));

describe("JobWait", () => {
  it("uses generation language without cards, stages, or backend logs", () => {
    const html = renderToStaticMarkup(
      <JobWait profile={jobWaitProfiles.customStyle} startedAt={Date.now()} />
    );

    expect(html).toContain("Custom Style / Forming");
    expect(html).toContain("Forming");
    expect(html).toContain("Your style");
    expect(html).toContain("Turning your direction into a reusable visual system.");
    expect(html).toContain("Direction");
    expect(html).toContain("Style");
    expect(html).toContain("Elapsed");
    expect(html).toContain("You can leave this page.");
    expect(html).toContain("01 / Reusable");
    expect(html).toContain("job-wait");
    expect(html).not.toContain("Analyzing");
    expect(html).not.toContain("Extracting palette");
    expect(html).not.toContain("Building material");
    expect(html).not.toContain("Interpreting");
    expect(html).not.toContain("job-pipeline");
    expect(html).not.toContain("job-status-pill");
    expect(html).not.toContain("progressbar");
    expect(html).not.toContain("Analyzing prompt");
  });

  it("keeps interrupted as the same frame with recovery, not a card stack", () => {
    const html = renderToStaticMarkup(
      <JobWait
        error="Provider stopped before a style was formed."
        profile={jobWaitProfiles.customStyle}
        status="interrupted"
        primary={<button type="button">Retry</button>}
        secondary={<button type="button">New style</button>}
      />
    );

    expect(html).toContain("Interrupted");
    expect(html).toContain("Provider stopped before a style was formed.");
    expect(html).toContain("Retry");
    expect(html).toContain("New style");
    expect(html).toContain("is-interrupted");
    expect(html).not.toContain("Elapsed");
  });
});

describe("JobResult", () => {
  it("renders review and stored as typography with a return to input", () => {
    const review = renderToStaticMarkup(
      <JobResult
        identity="Custom Style / Review"
        kicker="Direction received"
        title="Matte Armor"
        message="Review the formed style before you keep it or apply it to a model."
        actions={<button type="button">Save style</button>}
        secondary={<button type="button">Revise direction</button>}
      />
    );
    const stored = renderToStaticMarkup(
      <JobResult
        identity="Custom Style / Stored"
        kicker="In archive"
        title="Matte Armor"
        message="Saved privately. Apply it to a model, or start another direction."
        actions={<button type="button">Apply to a model →</button>}
        secondary={<button type="button">New style</button>}
      />
    );

    expect(review).toContain("Custom Style / Review");
    expect(review).toContain("Revise direction");
    expect(review).toContain("Save style");
    expect(stored).toContain("Custom Style / Stored");
    expect(stored).toContain("New style");
    expect(stored).not.toContain("Revise direction");
    expect(review).not.toContain("job-pipeline");
    expect(stored).not.toContain("badge");
  });
});
