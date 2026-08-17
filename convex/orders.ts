import { query } from "./functions";

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();

    return await Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await ctx.db
          .query("orderItems")
          .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
          .collect(),
      }))
    );
  },
});
