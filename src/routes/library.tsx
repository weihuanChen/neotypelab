import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  LibraryWorkbench,
  parseLibrarySearch,
} from "@/src/components/library/LibraryWorkbench";
import { noIndexRobots } from "@/src/lib/appPaths";

export const Route = createFileRoute("/library")({
  validateSearch: parseLibrarySearch,
  head: () => ({
    meta: [
      { title: "Library | NeotypeLab" },
      {
        name: "description",
        content:
          "Private prototype library, saved public builds, and generation ledger.",
      },
      noIndexRobots,
    ],
  }),
  component: LibraryRoute,
});

function LibraryRoute() {
  const search = Route.useSearch();

  return (
    <AppShell
      description="Prototype operations and saved builds."
      title="Library"
    >
      <LibraryWorkbench search={search} />
    </AppShell>
  );
}
