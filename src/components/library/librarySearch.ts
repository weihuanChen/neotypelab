export type LibrarySearch = {
  filter?: "all" | "draft" | "generated" | "archived" | "saved" | "jobs";
};

export function parseLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  return { filter: parseLibraryFilter(search.filter) };
}

function parseLibraryFilter(value: unknown): NonNullable<LibrarySearch["filter"]> {
  if (
    value === "all" ||
    value === "draft" ||
    value === "generated" ||
    value === "archived" ||
    value === "saved" ||
    value === "jobs"
  ) {
    return value;
  }
  return "all";
}
