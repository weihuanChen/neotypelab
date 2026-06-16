import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
import { TerminalShell } from "@/src/components/terminal/TerminalShell";
import {
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/t_/showcase")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "Showcase | NeotypeLab Terminal" },
      {
        name: "description",
        content:
          "Terminal view of published NeotypeLab repaint prototypes, creator packs, and discovery filters.",
      },
    ],
  }),
  component: TerminalShowcaseRoute,
});

function TerminalShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <TerminalShell
      activePath="/t/showcase"
      description="Terminal view of published prototypes, creator packs, and discovery filters."
      title="Showcase"
    >
      <div className="prototype-action-row">
        <a className="showcase-button" href="/showcase">
          Public Showcase
        </a>
      </div>
      <ShowcaseFeed basePath="/t/showcase" search={search} snapshot={snapshot} />
    </TerminalShell>
  );
}
