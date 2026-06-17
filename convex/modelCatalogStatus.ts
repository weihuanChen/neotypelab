import { Doc } from "./_generated/dataModel";
import { ModelCatalogStatus } from "./domain";

export type ModelCatalogRecord =
  | Doc<"baseModels">
  | Doc<"baseUnits">
  | Doc<"ipSeries">;

export function resolveModelCatalogStatus(record: {
  isActive: boolean;
  status?: ModelCatalogStatus;
}): ModelCatalogStatus {
  return record.status ?? (record.isActive ? "active" : "archived");
}

export function isPublicModelCatalogRecord(record: {
  isActive: boolean;
  status?: ModelCatalogStatus;
}) {
  return resolveModelCatalogStatus(record) === "active";
}
