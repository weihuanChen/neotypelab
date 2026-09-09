import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LibraryDetailPage } from "@/src/components/library/LibraryDetailPage";
import { parseLibraryDetailSearch } from "@/src/components/library/libraryDetailSearch";
import { noIndexRobots } from "@/src/lib/appPaths";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/library_/$conceptId")({
  validateSearch: parseLibraryDetailSearch,
  head: () => ({ meta: [{ title: "Work details | NeotypeLab" }, noIndexRobots] }),
  component: LibraryDetailRoute,
  errorComponent: ({ reset }) => (
    <AppShell title="Work details">
      <section className="work-detail-state" role="alert">
        <h1>We couldn’t load this work.</h1>
        <p>Try again, or return to your library.</p>
        <Button variant="outline" onClick={reset}>Try again</Button>
        <Link to="/library">Back to library</Link>
      </section>
    </AppShell>
  ),
});

function LibraryDetailRoute() {
  const { conceptId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AppShell title="Work details" description="Your repaint, its specifications and its resources.">
      <LibraryDetailPage conceptId={conceptId} tab={tab} onTabChange={(next) => void navigate({ search: { tab: next } })} />
    </AppShell>
  );
}
