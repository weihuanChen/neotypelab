import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/showcase")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "NeotypeLab Showcase" },
      {
        name: "description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:title", content: "NeotypeLab Showcase" },
      {
        property: "og:description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShowcaseRoute,
});

function ShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <main className="showcase-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Public</p>
          <h1>Published prototype showcase</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/">
            Home
          </a>
          <a className="showcase-button" href="/t/showcase">
            Open Terminal
          </a>
        </div>
      </section>
      <ShowcaseFeed search={search} snapshot={snapshot} />
    </main>
  );
}
