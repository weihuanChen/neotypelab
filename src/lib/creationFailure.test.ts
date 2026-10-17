import { describe, expect, it } from "vitest";
import { creationFailureMessage } from "@/lib/creationFailure";

describe("public creation failure messages", () => {
  it.each(["palette", "specification", "render"] as const)("never echoes arbitrary diagnostics for %s", stage => {
    const reason = "Uncaught Error: private-key-value upstream response at convex/creativePipeline.ts:380";
    const message = creationFailureMessage(reason, stage);
    expect(message).not.toMatch(/private|upstream|convex|380|Error/);
    expect(message.length).toBeLessThan(160);
    expect(creationFailureMessage(message, stage)).toBe(message);
    expect(creationFailureMessage(undefined, stage)).toBe(message);
  });

  it("keeps only useful categories from failures and does not repeat refund claims", () => {
    expect(creationFailureMessage("Uncaught Error: style conflicts with selected finish", "palette")).toContain("requirements conflict");
    expect(creationFailureMessage("Preview timed out. Your credits were returned", "render")).toContain("took too long");
    expect(creationFailureMessage("Provider content_filter private response", "render")).toContain("content policy");
    expect(creationFailureMessage("Preview generation was canceled", "render")).toContain("canceled");
    expect(creationFailureMessage("Preview timed out. Your credits were returned", "render")).not.toContain("credits");
  });
});
