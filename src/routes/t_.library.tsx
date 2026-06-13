import { createFileRoute } from "@tanstack/react-router";
import {
  LibraryWorkbench,
  parseLibrarySearch,
} from "@/src/components/library/LibraryWorkbench";

export const Route = createFileRoute("/t_/library")({
  validateSearch: parseLibrarySearch,
  head: () => ({
    meta: [
      { title: "Library | NeotypeLab Terminal" },
      {
        name: "description",
        content:
          "Authenticated prototype library, saved public builds, and generation ledger for NeotypeLab Terminal.",
      },
    ],
  }),
  component: LibraryRoute,
});

function LibraryRoute() {
  const search = Route.useSearch();

  return <LibraryWorkbench search={search} />;
}
