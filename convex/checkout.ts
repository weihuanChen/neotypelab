import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { createCreemCreditPackCheckout, createCreemSubscriptionCheckout } from "./creemBilling";
import { CHECKOUT_COUNTRY, selectCheckoutProvider } from "./paymentRouter";

const plan = v.union(v.literal("pro"), v.literal("studio"));
const credits = v.union(v.literal(64), v.literal(160), v.literal(400));

export const create = action({
  args: {
    returnOrigin: v.string(),
    paymentMethod: v.union(v.literal("card"), v.literal("other")),
    plan: v.optional(plan),
    credits: v.optional(credits),
  },
  handler: async (ctx, args): Promise<
    { status: "redirect"; url: string } | { status: "scheduled" }
  > => {
    const target = checkoutTarget(args);
    const provider = selectCheckoutProvider({
      offer: target.kind === "plan" ? target.plan : "pack",
      country: CHECKOUT_COUNTRY,
      paymentMethod: args.paymentMethod,
    });

    if (target.kind === "plan" && target.plan === "studio") {
      const viewer = await ctx.runQuery(api.users.viewer, {});
      if (viewer?.entitlements.planType === "pro") {
        if (provider === "creem") {
          await ctx.runMutation(api.creemBilling.upgradeToStudio, {});
          return { status: "scheduled" };
        }
        const upgrade: { url: string } = await ctx.runAction(api.waffoCheckout.createStudioUpgradeCheckout, {
          returnOrigin: args.returnOrigin,
        });
        return { status: "redirect", url: upgrade.url };
      }
    }

    if (provider === "creem") {
      const checkout = target.kind === "plan"
        ? await createCreemSubscriptionCheckout(ctx, {
          returnOrigin: args.returnOrigin,
          planType: target.plan,
        })
        : await createCreemCreditPackCheckout(ctx, {
          returnOrigin: args.returnOrigin,
          credits: target.credits,
        });
      return { status: "redirect", url: checkout.url };
    }

    if (target.kind === "plan") {
      const checkout: { url: string } = await ctx.runAction(api.waffoCheckout.createSubscriptionCheckout, {
        returnOrigin: args.returnOrigin,
        planType: target.plan,
      });
      return { status: "redirect", url: checkout.url };
    }
    const checkout: { url: string } = await ctx.runAction(api.waffoCheckout.createCreditPackCheckout, {
      returnOrigin: args.returnOrigin,
      credits: target.credits,
    });
    return { status: "redirect", url: checkout.url };
  },
});

function checkoutTarget(args: {
  plan?: "pro" | "studio";
  credits?: 64 | 160 | 400;
}): { kind: "plan"; plan: "pro" | "studio" } | { kind: "pack"; credits: 64 | 160 | 400 } {
  if (args.plan !== undefined && args.credits === undefined) return { kind: "plan", plan: args.plan };
  if (args.credits !== undefined && args.plan === undefined) return { kind: "pack", credits: args.credits };
  throw new Error("Choose one plan or Credit Pack");
}
