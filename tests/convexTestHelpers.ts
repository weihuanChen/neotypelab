import type { UserIdentity } from "convex/server";
import type { TestConvex } from "convex-test";
import type schema from "@/convex/schema";

type TestBackend = TestConvex<typeof schema>;

export async function seedUser(
  t: TestBackend,
  input: {
    tokenIdentifier: string;
    email: string;
    isAdmin?: boolean;
    balance?: number;
    accountStatus?: "active" | "suspended";
  }
) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      fullName: input.email.split("@")[0],
      onboardingCompleted: true,
      planType: "free",
      accountStatus: input.accountStatus ?? "active",
      isAdmin: input.isAdmin ?? false,
      email: input.email,
      tokenIdentifier: input.tokenIdentifier,
      handle: input.email.split("@")[0],
      searchText: input.email,
    });
    await ctx.db.insert("creditAccounts", {
      userId: id,
      balance: input.balance ?? 0,
      lifetimeGranted: input.balance ?? 0,
      lifetimeSpent: 0,
    });
    return id;
  });

  const identity: Partial<UserIdentity> = {
    tokenIdentifier: input.tokenIdentifier,
    subject: input.tokenIdentifier,
    issuer: "https://test.clerk.accounts.dev",
    email: input.email,
  };

  return { userId, client: t.withIdentity(identity) };
}
