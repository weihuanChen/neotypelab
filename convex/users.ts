import { canManagePlatform, isSuperAdminEmail } from "./adminAccess";
import { mutation, query } from "./functions";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./types";
import { slugify } from "./utils";

const STARTER_CREDITS = 25;

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Called api.users.store without valid auth token");
    }

    let user = await ctx
      .db.query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (identity.email === undefined) {
      throw new Error("User does not have an email address");
    }
    const email = identity.email;
    const shouldBootstrapAsAdmin = isSuperAdminEmail(email);

    const nameFallback = emailUserName(email);
    const userFields = {
      fullName: identity.name ?? nameFallback,
      tokenIdentifier: identity.tokenIdentifier,
      email,
      pictureUrl: identity.pictureUrl,
      firstName: identity.givenName,
      lastName: identity.familyName,
      onboardingCompleted: false,
      planType: "free" as const,
      accountStatus: "active" as const,
    };

    if (user === null) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
    }

    if (user !== null) {
      await ctx.db.patch(user._id, {
        ...userFields,
        isAdmin: user.isAdmin || shouldBootstrapAsAdmin,
      });
    } else {
      const userId = await ctx.db.insert("users", {
        ...userFields,
        isAdmin: shouldBootstrapAsAdmin,
        handle: await getUniqueHandle(ctx, identity.nickname ?? nameFallback),
      });
      user = await ctx.db.get(userId);
      if (user === null) {
        throw new Error("Failed to create viewer record");
      }
      await createStarterCreditAccount(ctx, user._id);
    }

    await ensureCreditAccountExists(ctx, user._id);
    return { userId: user._id, handle: user.handle };
  },
});

export const viewer = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return null;
    }

    const creditAccount = await ctx
      .db.query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .unique();

    return {
      _id: ctx.viewer._id,
      email: ctx.viewer.email,
      fullName: ctx.viewer.fullName,
      handle: ctx.viewer.handle,
      pictureUrl: ctx.viewer.pictureUrl,
      onboardingCompleted: ctx.viewer.onboardingCompleted,
      planType: ctx.viewer.planType,
      accountStatus: ctx.viewer.accountStatus,
      isAdmin: ctx.viewer.isAdmin,
      isSuperAdmin: isSuperAdminEmail(ctx.viewer.email),
      canManagePlatform: canManagePlatform(ctx.viewer),
      credits: {
        balance: creditAccount?.balance ?? 0,
        lifetimeGranted: creditAccount?.lifetimeGranted ?? 0,
        lifetimeSpent: creditAccount?.lifetimeSpent ?? 0,
      },
    };
  },
});

export const adminAccessStatus = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    const identityEmail = identity?.email ?? null;
    const viewer = ctx.viewer;
    const creditAccount =
      viewer === null
        ? null
        : await ctx.db
            .query("creditAccounts")
            .withIndex("by_userId", (q) => q.eq("userId", viewer._id))
            .unique();

    return {
      connectedDeploymentUrl: process.env.CONVEX_CLOUD_URL ?? null,
      identityEmail,
      identityTokenIdentifier: identity?.tokenIdentifier ?? null,
      identityIsSuperAdmin: isSuperAdminEmail(identityEmail),
      viewerFound: viewer !== null,
      viewerEmail: viewer?.email ?? null,
      viewerHandle: viewer?.handle ?? null,
      viewerIsAdmin: viewer?.isAdmin ?? false,
      viewerIsSuperAdmin: viewer ? isSuperAdminEmail(viewer.email) : false,
      canManagePlatform:
        viewer !== null ? canManagePlatform(viewer) : isSuperAdminEmail(identityEmail),
      creditBalance: creditAccount?.balance ?? 0,
    };
  },
});

function emailUserName(email: string) {
  return email.split("@")[0];
}

async function getUniqueHandle(
  ctx: MutationCtx,
  input: string
) {
  const base = slugify(input) || "pilot";
  let candidate = base;
  let suffix = 1;
  while (
    (await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", candidate))
      .unique()) !== null
  ) {
    candidate = `${base}${suffix}`;
    suffix++;
  }
  return candidate;
}

async function ensureCreditAccountExists(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const existing = await ctx.db
    .query("creditAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing === null) {
    await createStarterCreditAccount(ctx, userId);
  }
}

async function createStarterCreditAccount(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const accountId = await ctx.db.insert("creditAccounts", {
    userId,
    balance: STARTER_CREDITS,
    lifetimeGranted: STARTER_CREDITS,
    lifetimeSpent: 0,
    lastCreditEventAt: Date.now(),
  });
  await ctx.db.insert("creditTransactions", {
    userId,
    actionType: "starter-grant",
    delta: STARTER_CREDITS,
    creditAmount: STARTER_CREDITS,
    balanceAfter: STARTER_CREDITS,
    referenceTable: "creditAccounts",
    referenceId: accountId,
    description: `Initialized account ${accountId} with starter credits`,
  });
}
