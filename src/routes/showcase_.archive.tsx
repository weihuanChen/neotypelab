import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
import {
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/showcase_/archive")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "Public Archive | NeotypeLab" },
      {
        name: "description",
        content: "Search and filter the complete NeotypeLab public prototype archive.",
      },
    ],
    links: [{ rel: "canonical", href: "/showcase/archive" }],
  }),
  component: ShowcaseArchiveRoute,
});

function ShowcaseArchiveRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AppShell
      description="Search every published prototype by kit, Style DNA, material, category, and creator."
      title="Public Archive"
    >
      <main className="showcase-page">
        <ShowcaseFeed
          basePath="/showcase/archive"
          search={search}
          snapshot={snapshot}
        />
      </main>
    </AppShell>
  );
}
