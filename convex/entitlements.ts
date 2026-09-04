import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx as BaseQueryCtx } from "./_generated/server";
import { query } from "./functions";
import {
  applyEntitlementGrant,
  DEFAULT_ENTITLEMENT_PROFILES,
  entitlementValuesFromProfile,
  isEntitlementGrantActive,
} from "./entitlementPolicy";

export async function resolveEffectiveEntitlements(
  ctx: Pick<BaseQueryCtx, "db">,
  userId: Id<"users">,
  now = Date.now()
) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found while resolving entitlements");
  }

  const explicitProfile = user.entitlementProfileId
    ? await ctx.db.get(user.entitlementProfileId)
    : null;
  const planProfiles = explicitProfile?.isActive
    ? []
    : await ctx.db
        .query("entitlementProfiles")
        .withIndex("by_plan_revision", (q) => q.eq("planType", user.planType))
        .order("desc")
        .collect();
  const profile = explicitProfile?.isActive
    ? explicitProfile
    : planProfiles.find((candidate) => candidate.isActive) ?? null;
  const fallback = DEFAULT_ENTITLEMENT_PROFILES[user.planType];
  const grants = await ctx.db
    .query("accountEntitlementGrants")
    .withIndex("by_user_startsAt", (q) => q.eq("userId", userId).lte("startsAt", now))
    .collect();
  const activeGrants = grants.filter((grant) => isEntitlementGrantActive(grant, now));
  const values = activeGrants.reduce(
    (current, grant) => applyEntitlementGrant(current, grant),
    entitlementValuesFromProfile(profile ?? fallback)
  );

  return {
    ...values,
    planType: user.planType,
    profileId: profile?._id ?? null,
    profileSlug: profile?.slug ?? fallback.slug,
    profileRevision: profile?.revision ?? fallback.revision,
    activeGrantIds: activeGrants.map((grant) => grant._id),
    resolvedAt: now,
  };
}

export const viewerEffective = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) return null;
    return await resolveEffectiveEntitlements(ctx, ctx.viewerX()._id);
  },
});

export type EffectiveEntitlements = Awaited<
  ReturnType<typeof resolveEffectiveEntitlements>
>;

export type EntitlementProfile = Doc<"entitlementProfiles">;
