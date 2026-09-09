export type LibraryDetailTab = "overview" | "resources" | "history";

export function parseLibraryDetailSearch(search: Record<string, unknown>): { tab: LibraryDetailTab } {
  return { tab: search.tab === "resources" || search.tab === "history" ? search.tab : "overview" };
}
