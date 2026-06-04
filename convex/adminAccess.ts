import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./types";

const SUPER_ADMIN_EMAILS_ENV = "SUPER_ADMIN_EMAILS";

export function parseSuperAdminEmails() {
  return new Set(
    (process.env[SUPER_ADMIN_EMAILS_ENV] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isSuperAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  return parseSuperAdminEmails().has(email.trim().toLowerCase());
}

export function canManagePlatform(user?: { email: string; isAdmin: boolean } | null) {
  if (!user) {
    return false;
  }
  return user.isAdmin || isSuperAdminEmail(user.email);
}

export function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const viewer = ctx.viewerX();
  if (!canManagePlatform(viewer)) {
    throw new Error("Super admin access required");
  }
  return {
    viewer,
    isEnvSuperAdmin: isSuperAdminEmail(viewer.email),
  };
}

export async function writeAdminAuditLog(
  ctx: MutationCtx,
  {
    action,
    actorUserId,
    detailsJson,
    entityId,
    entityType,
  }: {
    action: string;
    actorUserId: Id<"users">;
    detailsJson?: string;
    entityId?: string;
    entityType: string;
  }
) {
  await ctx.db.insert("adminAuditLogs", {
    userId: actorUserId,
    action,
    entityType,
    entityId,
    detailsJson,
  });
}

export { SUPER_ADMIN_EMAILS_ENV };
