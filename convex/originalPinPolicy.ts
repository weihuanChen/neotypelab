import type { Id } from "./_generated/dataModel";

const MIB = 1024 ** 2;

export const ORIGINAL_PIN_PRICE_TIERS = [
  { maxBytes: 8 * MIB, creditCost: 10 },
  { maxBytes: 20 * MIB, creditCost: 20 },
  { maxBytes: 50 * MIB, creditCost: 40 },
] as const;

export const MAX_ORIGINAL_PIN_BYTES = ORIGINAL_PIN_PRICE_TIERS.at(-1)!.maxBytes;

export function originalPinCreditCost(byteSize: number) {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new Error("Original file size is unavailable");
  }
  const tier = ORIGINAL_PIN_PRICE_TIERS.find((candidate) => byteSize <= candidate.maxBytes);
  if (!tier) {
    throw new Error("Originals larger than 50 MB cannot be kept with a fixed credit price");
  }
  return tier.creditCost;
}

export function buildPinnedOriginalKey(input: {
  userId: Id<"users">;
  mediaAssetId: Id<"mediaAssets">;
  assetVersionId: Id<"assetVersions">;
  sourceKey: string;
}) {
  const extension = safeExtension(input.sourceKey);
  return `pinned-originals/users/${input.userId}/${input.mediaAssetId}/${input.assetVersionId}/original${extension}`;
}

function safeExtension(key: string) {
  const fileName = key.split("/").at(-1) ?? "";
  const match = fileName.match(/\.[a-zA-Z0-9]{1,8}$/);
  return match ? match[0].toLowerCase() : ".bin";
}
