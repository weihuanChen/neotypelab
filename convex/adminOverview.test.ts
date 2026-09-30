import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");

describe("admin overview reads", () => {
  it("counts each generation status from its own index", async () => {
    const t = convexTest(schema, modules);
    const admin = await seedUser(t, { tokenIdentifier: "overview-admin", email: "admin@example.test", isAdmin: true, balance: 12 });
    await t.run(async (ctx) => {
      await ctx.db.insert("generationJobs", { userId: admin.userId, kind: "hd-preview", status: "queued", requestedCredits: 1 });
      await ctx.db.insert("generationJobs", { userId: admin.userId, kind: "hd-preview", status: "failed", requestedCredits: 1, errorMessage: "render failed", provider: "openai" });
      await ctx.db.insert("generationJobs", { userId: admin.userId, kind: "hd-preview", status: "succeeded", requestedCredits: 1, outputSummaryJson: "{}" });
    });

    const [people, queued, failed, succeeded] = await Promise.all([
      admin.client.query(api.admin.overviewPeople, {}),
      admin.client.query(api.admin.overviewJobCount, { status: "queued" }),
      admin.client.query(api.admin.overviewFailedJobs, {}),
      admin.client.query(api.admin.overviewJobCount, { status: "succeeded" }),
    ]);

    expect(people.userCount).toBe(1);
    expect(people.totalCreditBalance).toBe(12);
    expect(queued).toBe(1);
    expect(succeeded).toBe(1);
    expect(failed.count).toBe(1);
    expect(failed.recent[0]?.errorMessage).toBe("render failed");
  });
});
