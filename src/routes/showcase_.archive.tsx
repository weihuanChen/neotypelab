import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import { systemStates } from "@/src/components/system-state";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";
import {
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const archiveShell = {
  description: "Search published Gunpla and mecha paint plans by kit, color direction, finish, weathering, and builder.",
  title: "Archive",
} as const;

export const Route = createFileRoute("/showcase_/archive")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingMs: 0,
  pendingComponent: ShowcaseArchivePending,
  head: () => ({
    meta: documentMeta(publicSeo.archive, { ogType: "website" }),
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
