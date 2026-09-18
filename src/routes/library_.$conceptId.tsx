import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LibraryDetailPage } from "@/src/components/library/LibraryDetailPage";
import { parseLibraryDetailSearch } from "@/src/components/library/libraryDetailSearch";
import { noIndexRobots } from "@/src/lib/appPaths";
import { SystemState, SystemStateLink, systemStates } from "@/src/components/system-state";

export const Route = createFileRoute("/library_/$conceptId")({
  validateSearch: parseLibraryDetailSearch,
  head: () => ({ meta: [{ title: "Work details | NeotypeLab" }, noIndexRobots] }),
  component: LibraryDetailRoute,
  errorComponent: ({ reset }) => (
    <AppShell title="Work details">
      <SystemState
        {...systemStates.serverError}
        archive="Library / Render interrupted"
        headline={"We could not\nload this work."}
        message={["Try again, or return to a known record in your library."]}
        primary={
          <button className="system-state__button" onClick={reset} type="button">
            Try again
          </button>
        }
        secondary={<SystemStateLink to="/library">Return to Library ←</SystemStateLink>}
      />
    </AppShell>
  ),
});

function LibraryDetailRoute() {
  const { conceptId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AppShell title="Work details" description="Your repaint, its specifications and its resources.">
      <LibraryDetailPage
        conceptId={conceptId}
        tab={tab}
        onTabChange={(next) => void navigate({ search: { tab: next }, replace: true, resetScroll: false })}
      />
    </AppShell>
  );
}
