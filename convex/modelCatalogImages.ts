import { v } from "convex/values";

export const KIT_IMAGE_KINDS = ["cover", "fullBody"] as const;
export type KitImageKind = (typeof KIT_IMAGE_KINDS)[number];
export const vKitImageKind = v.union(v.literal("cover"), v.literal("fullBody"));

export function kitImageField(kind: KitImageKind): "thumbnailAssetKey" | "fullBodyAssetKey" {
  return kind === "cover" ? "thumbnailAssetKey" : "fullBodyAssetKey";
}

export function isManagedCatalogKey(key?: string | null): key is string {
  return Boolean(key && !/^https:\/\//.test(key) && key.startsWith("catalog/kits/"));
}

export function assertCatalogImageReference(value?: string) {
  if (!value) return;
  if (value.includes(":") && !/^https:\/\//.test(value)) {
    throw new Error("Use an HTTPS image URL or an R2 object key");
  }
}
