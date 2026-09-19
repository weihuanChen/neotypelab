import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import { systemStates } from "@/src/components/system-state";
import {
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const archiveShell = {
  description: "Search every published prototype by kit, Style DNA, material, category, and creator.",
  title: "Public Archive",
} as const;

export const Route = createFileRoute("/showcase_/archive")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingMs: 0,
  pendingComponent: ShowcaseArchivePending,
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

function ShowcaseArchivePending() {
  return <RoutePending {...archiveShell} state={systemStates.showcaseLoading} />;
}

function ShowcaseArchiveRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AppShell {...archiveShell}>
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
