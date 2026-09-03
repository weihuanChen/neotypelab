export const categoryOptions = [
  { value: "missing-base-model", label: "Missing Kit", detail: "Request a kit or silhouette that is not available in the catalog yet." },
  { value: "style-request", label: "Style Request", detail: "Suggest a new visual direction for the Style DNA library." },
  { value: "generation-quality", label: "Generation Issue", detail: "Report anatomy, masking, realism, or rendering problems." },
  { value: "paint-mapping", label: "Paint Mapping", detail: "Flag a missing, inaccurate, or impractical paint recommendation." },
  { value: "other", label: "Other", detail: "Send feedback that does not fit the main report types." },
] as const;

export type FeedbackCategory = (typeof categoryOptions)[number]["value"];
export type FeedbackWorkbenchSearch = {
  conceptId?: string;
  generationJobId?: string;
  type?: FeedbackCategory;
  source?: "prototype" | "generation-result" | "showcase" | "library";
};

export function parseFeedbackSearch(search: Record<string, unknown>): FeedbackWorkbenchSearch {
  const conceptId = optionalString(search.conceptId);
  const generationJobId = optionalString(search.generationJobId);
  const type = optionalString(search.type);
  const source = optionalString(search.source);
  return {
    conceptId,
    generationJobId,
    type: categoryOptions.some((option) => option.value === type) ? type as FeedbackCategory : undefined,
    source: ["prototype", "generation-result", "showcase", "library"].includes(source ?? "")
      ? source as FeedbackWorkbenchSearch["source"]
      : undefined,
  };
}

export function formatCategory(category: string) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

export function formatStatus(status: string) {
  if (status === "open") return "Received";
  if (status === "triaged" || status === "reviewing") return "Reviewing";
  if (status === "resolved") return "Resolved";
  if (status === "rejected") return "Rejected";
  return status;
}

export function formatFeedbackReference(recordNumber?: number, id?: string) {
  return recordNumber ? `F-${String(recordNumber).padStart(4, "0")}` : `F-${id?.slice(-6).toUpperCase() ?? "PENDING"}`;
}

export function formatPrototypeReference(recordNumber?: number, id?: string) {
  return recordNumber ? `N\u00b0.${String(recordNumber).padStart(3, "0")}` : id ? "Shared prototype" : "Prototype";
}

export function formatReportDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
