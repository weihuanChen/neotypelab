import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { BASE_BLOCKLIST } from "./contentBlocklistPolicy";

const modules = import.meta.glob("./**/*.ts");

describe("blocklist storage", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("falls back to the base list, seeds idempotently, and honours operator changes", async () => {
    expect(await t.query(internal.contentBlocklist.activeTerms, {})).toHaveLength(BASE_BLOCKLIST.length);

    const first = await t.mutation(internal.contentBlocklist.seedBaseTerms, {});
    expect(first.inserted).toBeGreaterThan(0);
    await t.mutation(internal.contentBlocklist.setTermActive, { term: "Disney", isActive: false, note: "false positives" });
    await t.mutation(internal.contentBlocklist.addTerm, { term: "  Gundam-Killer Gore Pack ", category: "violence" });
    expect((await t.mutation(internal.contentBlocklist.seedBaseTerms, {})).inserted).toBe(0);

    const active = await t.query(internal.contentBlocklist.activeTerms, {});
    expect(active.some((entry) => entry.term === "disney")).toBe(false);
    expect(active).toContainEqual({ term: "gundam killer gore pack", category: "violence" });
  });
});
