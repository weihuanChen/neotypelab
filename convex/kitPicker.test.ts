import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
const browse = { search: "", scope: "all" as const, page: 1, universes: [], grades: [], manufacturers: [], types: [] };
describe("kit lookup", () => {
  it("finds punctuated model aliases and searches scale independently from grade", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.init, {});
    const match = await t.query(api.kitPicker.browse, { ...browse, search: "RX78" });
    expect(match.items.some(kit => kit.name.includes("RX-78"))).toBe(true);
    const scaled = await t.query(api.kitPicker.browse, { ...browse, search: "1/100", grades: ["MG"] });
    expect(scaled.items.length).toBeGreaterThan(0);
    expect(scaled.items.every(kit => kit.grade === "MG" && kit.scale === "1/100")).toBe(true);
    expect(match.items[0]).not.toHaveProperty("tags");
  });
  it("keeps favorites per account, excludes archived kits, and returns bounded pages", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.init, {});
    const owner = await seedUser(t, { tokenIdentifier: "kit-owner", email: "kit@example.test" });
    const other = await seedUser(t, { tokenIdentifier: "kit-other", email: "other@example.test" });
    const kit = (await t.query(api.kitPicker.browse, browse)).items[0];
    await owner.client.mutation(api.kitPicker.favorite, { kitId: kit.id, selected: true });
    await owner.client.mutation(api.kitPicker.favorite, { kitId: kit.id, selected: true });
    expect((await owner.client.query(api.kitPicker.browse, { ...browse, scope: "favorites" })).items).toHaveLength(1);
    expect((await other.client.query(api.kitPicker.browse, { ...browse, scope: "favorites" })).items).toHaveLength(0);
    await t.run(async ctx => {
      const { _id, _creationTime, ...fields } = (await ctx.db.get(kit.id))!;
      for (let i = 0; i < 30; i++) await ctx.db.insert("baseModels", { ...fields, slug: `test-${i}`, name: `Kit ${i}` });
      await ctx.db.patch(kit.id, { status: "archived", isActive: false });
    });
    expect((await owner.client.query(api.kitPicker.browse, { ...browse, scope: "favorites" })).items).toHaveLength(0);
    const first = await t.query(api.kitPicker.browse, browse);
    const second = await t.query(api.kitPicker.browse, { ...browse, page: 2 });
    expect(first.items).toHaveLength(18);
    expect(second.items.some(row => first.items.some(a => a.id === row.id))).toBe(false);
  });
});
