import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type ModelCatalogData = FunctionReturnType<
  typeof api.modelCatalogAdmin.listModelCatalogData
>;
export type IpSeriesItem = ModelCatalogData["ipSeries"][number];
export type BaseUnitItem = ModelCatalogData["baseUnits"][number];
export type KitVariantItem = ModelCatalogData["kitVariants"][number];

export type RecordType = "ipSeries" | "baseUnit" | "kitVariant";
export type ModelCatalogStatus = "active" | "prerelease" | "archived";
export type StatusFilter = ModelCatalogStatus | "all";

export type RecordSelection = {
  id: string;
  type: RecordType;
};

export type IpSeriesDraft = {
  manufacturer: string;
  name: string;
  promptAnchor: string;
  rightsOwner: string;
  slug: string;
  status: ModelCatalogStatus;
  universe: string;
  visualDNA: string;
};

export type BaseUnitDraft = {
  aliases: string[];
  forbiddenChanges: string[];
  ipSeriesId: string;
  keyShapeAnchors: string[];
  name: string;
  nativeEquipment: string[];
  promptAnchor: string;
  silhouetteType: string;
  slug: string;
  status: ModelCatalogStatus;
  unitCode: string;
};

export type KitVariantDraft = {
  aliases: string[];
  baseUnitId: string;
  complexityLevel: string;
  grade: string;
  name: string;
  panelDensity: string;
  primaryModelBrand: string;
  promptAnchor: string;
  releaseVersion: string;
  scale: string;
  slug: string;
  status: ModelCatalogStatus;
  tags: string[];
  thumbnailAssetKey: string;
};

export type CatalogDraft = IpSeriesDraft | BaseUnitDraft | KitVariantDraft;

export const emptyIpSeriesDraft: IpSeriesDraft = {
  manufacturer: "",
  name: "",
  promptAnchor: "",
  rightsOwner: "",
  slug: "",
  status: "active",
  universe: "",
  visualDNA: "",
};

export const emptyBaseUnitDraft: BaseUnitDraft = {
  aliases: [],
  forbiddenChanges: [],
  ipSeriesId: "",
  keyShapeAnchors: [],
  name: "",
  nativeEquipment: [],
  promptAnchor: "",
  silhouetteType: "",
  slug: "",
  status: "active",
  unitCode: "",
};

export const emptyKitVariantDraft: KitVariantDraft = {
  aliases: [],
  baseUnitId: "",
  complexityLevel: "",
  grade: "",
  name: "",
  panelDensity: "",
  primaryModelBrand: "",
  promptAnchor: "",
  releaseVersion: "",
  scale: "",
  slug: "",
  status: "active",
  tags: [],
  thumbnailAssetKey: "",
};

export function createIpSeriesDraft(item: IpSeriesItem): IpSeriesDraft {
  return {
    manufacturer: item.manufacturer ?? "",
    name: item.name,
    promptAnchor: item.promptAnchor ?? "",
    rightsOwner: item.rightsOwner ?? item.manufacturer ?? "",
    slug: item.slug,
    status: item.status,
    universe: item.universe ?? "",
    visualDNA: item.visualDNA ?? "",
  };
}

export function createBaseUnitDraft(item: BaseUnitItem): BaseUnitDraft {
  return {
    aliases: item.aliases,
    forbiddenChanges: item.forbiddenChanges,
    ipSeriesId: item.ipSeriesId,
    keyShapeAnchors: item.keyShapeAnchors,
    name: item.name,
    nativeEquipment: item.nativeEquipment,
    promptAnchor: item.promptAnchor ?? "",
    silhouetteType: item.silhouetteType ?? "",
    slug: item.slug,
    status: item.status,
    unitCode: item.unitCode ?? "",
  };
}

export function createKitVariantDraft(item: KitVariantItem): KitVariantDraft {
  return {
    aliases: item.aliases,
    baseUnitId: item.baseUnitId ?? "",
    complexityLevel: item.complexityLevel ?? "",
    grade: item.grade ?? "",
    name: item.name,
    panelDensity: item.panelDensity ?? "",
    primaryModelBrand: item.primaryModelBrand ?? "",
    promptAnchor: item.promptAnchor ?? "",
    releaseVersion: item.releaseVersion ?? "",
    scale: item.scale ?? "",
    slug: item.slug,
    status: item.status,
    tags: item.tags,
    thumbnailAssetKey: item.thumbnailAssetKey ?? "",
  };
}

export function recordKey(selection: RecordSelection) {
  return `${selection.type}:${selection.id}`;
}

export function recordTypeLabel(type: RecordType) {
  if (type === "ipSeries") return "IP / Series";
  if (type === "baseUnit") return "Base Unit";
  return "Kit Variant";
}

export function statusLabel(status: ModelCatalogStatus) {
  if (status === "prerelease") return "Pre-release";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
