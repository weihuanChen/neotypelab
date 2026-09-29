import { internalQuery } from "./functions";

export const currentProUpgradeOrder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const viewer = ctx.viewerX();
    const subscriptions = await ctx.db.query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", viewer._id)).collect();
    const current = subscriptions.find((subscription) =>
      subscription.provider === "waffo" && subscription.planType === "pro" &&
      subscription.status === "active" && subscription.currentPeriodEnd > Date.now()
    );
    return current ? { orderId: current.externalSubscriptionId, userId: viewer._id } : null;
  },
});
