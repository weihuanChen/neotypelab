import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");

describe("Waffo inbound event ledger", () => {
  it("records a verified event once by delivery ID without storing buyer details", async () => {
    const t = convexTest(schema, modules);
    const event = {
      eventId: "delivery-123",
      businessEventId: "order-event-123",
      eventType: "order.completed",
      storeId: "STO_test",
      mode: "test" as const,
      orderId: "ORD_test",
      orderMerchantExternalId: "internal-order-123",
      occurredAt: Date.now(),
    };
    expect(await t.mutation(internal.waffoWebhookEvents.record, event)).toEqual({ status: "recorded" });
    expect(await t.mutation(internal.waffoWebhookEvents.record, event)).toEqual({ status: "duplicate" });
    const stored = await t.run(async (ctx) => await ctx.db.query("waffoWebhookEvents").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      eventId: "delivery-123",
      eventType: "order.completed",
      outcome: "verified-unmapped",
    });
    expect("buyerEmail" in stored[0]!).toBe(false);
  });

  it("rejects missing delivery identifiers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.waffoWebhookEvents.record, {
      eventId: "",
      businessEventId: "",
      eventType: "order.completed",
      storeId: "STO_test",
      mode: "test",
      occurredAt: Date.now(),
    })).rejects.toThrow("identifiers");
  });

  it("links a signed buyer identity only to a matching local account", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "waffo-event-buyer",
      email: "waffo-event-buyer@example.test",
    });
    const base = {
      businessEventId: "PAY_123",
      eventType: "order.completed",
      storeId: "STO_test",
      mode: "test" as const,
      occurredAt: Date.now(),
      buyerIdentity: user.userId,
      metadataUserId: user.userId,
    };
    await t.mutation(internal.waffoWebhookEvents.record, { ...base, eventId: "delivery-matched" });
    await t.mutation(internal.waffoWebhookEvents.record, {
      ...base,
      eventId: "delivery-mismatched",
      metadataUserId: "another-user",
    });
    const rows = await t.run(async (ctx) => await ctx.db.query("waffoWebhookEvents").collect());
    expect(rows.find((row) => row.eventId === "delivery-matched")?.buyerUserId).toBe(user.userId);
    expect(rows.find((row) => row.eventId === "delivery-mismatched")?.buyerUserId).toBeUndefined();
  });
});
