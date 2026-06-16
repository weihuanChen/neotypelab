import { createFileRoute } from "@tanstack/react-router";
import {
  LibraryWorkbench,
  parseLibrarySearch,
} from "@/src/components/library/LibraryWorkbench";
import { TerminalShell } from "@/src/components/terminal/TerminalShell";

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

  return (
    <TerminalShell
      activePath="/t/library"
      description="Manage private concepts, saved public builds, render tools, and generation jobs."
      title="Library"
    >
      <LibraryWorkbench search={search} />
    </TerminalShell>
  );
}
