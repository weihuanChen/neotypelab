import type { Doc } from "./_generated/dataModel";
import type { UserPlan } from "./domain";

const GIB = 1024 ** 3;

export type EntitlementValues = {
  libraryQuotaBytes: number;
  temporaryOriginalQuotaBytes: number;
  pinnedOriginalQuotaBytes: number;
  originalRetentionDays: number;
  versionRetentionDays: number;
  masterMaxDimensionPx: number;
  exportMaxDimensionPx: number;
  originalPermanentStorage: boolean;
  originalDownloadAllowed: boolean;
  originalPinAllowed: boolean;
  batchDownloadAllowed: boolean;
};

export type DefaultEntitlementProfile = EntitlementValues & {
  name: string;
  slug: string;
  planType: UserPlan;
  revision: number;
  isActive: boolean;
};

export const DEFAULT_ENTITLEMENT_PROFILES: Record<UserPlan, DefaultEntitlementProfile> = {
  free: {
    name: "Free",
    slug: "free-default",
    planType: "free",
    revision: 1,
    libraryQuotaBytes: 2 * GIB,
    temporaryOriginalQuotaBytes: 2 * GIB,
    pinnedOriginalQuotaBytes: 2 * GIB,
    originalRetentionDays: 7,
    versionRetentionDays: 7,
    masterMaxDimensionPx: 2048,
    exportMaxDimensionPx: 2048,
    originalPermanentStorage: false,
    originalDownloadAllowed: true,
    originalPinAllowed: true,
    batchDownloadAllowed: false,
    isActive: true,
  },
  pro: {
    name: "Pro",
    slug: "pro-default",
    planType: "pro",
    revision: 1,
    libraryQuotaBytes: 20 * GIB,
    temporaryOriginalQuotaBytes: 20 * GIB,
    pinnedOriginalQuotaBytes: 20 * GIB,
    originalRetentionDays: 90,
    versionRetentionDays: 30,
    masterMaxDimensionPx: 2048,
    exportMaxDimensionPx: 4096,
    originalPermanentStorage: false,
    originalDownloadAllowed: true,
    originalPinAllowed: true,
    batchDownloadAllowed: false,
    isActive: true,
  },
  studio: {
    name: "Studio",
    slug: "studio-default",
    planType: "studio",
    revision: 1,
    libraryQuotaBytes: 100 * GIB,
    temporaryOriginalQuotaBytes: 100 * GIB,
    pinnedOriginalQuotaBytes: 100 * GIB,
    originalRetentionDays: 90,
    versionRetentionDays: 90,
    masterMaxDimensionPx: 4096,
    exportMaxDimensionPx: 4096,
    originalPermanentStorage: true,
    originalDownloadAllowed: true,
    originalPinAllowed: true,
    batchDownloadAllowed: true,
    isActive: true,
  },
};

export function entitlementValuesFromProfile(
  profile: DefaultEntitlementProfile | Doc<"entitlementProfiles">
): EntitlementValues {
  return {
    libraryQuotaBytes: profile.libraryQuotaBytes,
    temporaryOriginalQuotaBytes: profile.temporaryOriginalQuotaBytes,
    pinnedOriginalQuotaBytes: profile.pinnedOriginalQuotaBytes,
    originalRetentionDays: profile.originalRetentionDays,
    versionRetentionDays: profile.versionRetentionDays,
    masterMaxDimensionPx: profile.masterMaxDimensionPx,
    exportMaxDimensionPx: profile.exportMaxDimensionPx,
    originalPermanentStorage: profile.originalPermanentStorage,
    originalDownloadAllowed: profile.originalDownloadAllowed,
    originalPinAllowed: profile.originalPinAllowed,
    batchDownloadAllowed: profile.batchDownloadAllowed,
  };
}

export function applyEntitlementGrant(
  current: EntitlementValues,
  grant: Doc<"accountEntitlementGrants">
): EntitlementValues {
  return {
    libraryQuotaBytes: addNonNegative(
      current.libraryQuotaBytes,
      grant.libraryQuotaBytesDelta
    ),
    temporaryOriginalQuotaBytes: addNonNegative(
      current.temporaryOriginalQuotaBytes,
      grant.temporaryOriginalQuotaBytesDelta
    ),
    pinnedOriginalQuotaBytes: addNonNegative(
      current.pinnedOriginalQuotaBytes,
      grant.pinnedOriginalQuotaBytesDelta
    ),
    originalRetentionDays: maximumNonNegative(
      current.originalRetentionDays,
      grant.originalRetentionDays
    ),
    versionRetentionDays: maximumNonNegative(
      current.versionRetentionDays,
      grant.versionRetentionDays
    ),
    masterMaxDimensionPx: maximumNonNegative(
      current.masterMaxDimensionPx,
      grant.masterMaxDimensionPx
    ),
    exportMaxDimensionPx: maximumNonNegative(
      current.exportMaxDimensionPx,
      grant.exportMaxDimensionPx
    ),
    originalPermanentStorage:
      current.originalPermanentStorage || grant.originalPermanentStorage === true,
    originalDownloadAllowed:
      current.originalDownloadAllowed || grant.originalDownloadAllowed === true,
    originalPinAllowed: current.originalPinAllowed || grant.originalPinAllowed === true,
    batchDownloadAllowed:
      current.batchDownloadAllowed || grant.batchDownloadAllowed === true,
  };
}

export function isEntitlementGrantActive(
  grant: Pick<Doc<"accountEntitlementGrants">, "startsAt" | "expiresAt" | "revokedAt">,
  now: number
) {
  return grant.startsAt <= now && grant.revokedAt === undefined &&
    (grant.expiresAt === undefined || grant.expiresAt > now);
}

function addNonNegative(current: number, adjustment: number | undefined) {
  if (adjustment === undefined || !Number.isFinite(adjustment)) return current;
  return Math.max(0, current + adjustment);
}

function maximumNonNegative(current: number, candidate: number | undefined) {
  if (candidate === undefined || !Number.isFinite(candidate)) return current;
  return Math.max(current, Math.max(0, candidate));
}
