import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
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
    <main className="showcase-page">
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>Showcase</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/t">
            Terminal
          </a>
          <a className="showcase-button is-ghost" href="/t/create">
            Create
          </a>
          <a className="showcase-button is-ghost" href="/t/library">
            Library
          </a>
          <a className="showcase-button is-ghost" href="/t/feedback">
            Feedback
          </a>
          <a className="showcase-button" href="/showcase">
            Public Showcase
          </a>
        </div>
      </section>
      <ShowcaseFeed basePath="/t/showcase" search={search} snapshot={snapshot} />
    </main>
  );
}
