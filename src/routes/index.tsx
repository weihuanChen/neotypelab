import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ExploreLanding } from "@/src/components/showcase/ExploreLanding";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import { systemStates } from "@/src/components/system-state";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const exploreShell = {
  description:
    "Browse spray-ready Gunpla and mecha paint plans, then open a scheme or remix it before you spray.",
  title: "Explore",
} as const;

export const Route = createFileRoute("/")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingMs: 0,
  pendingComponent: ExplorePending,
  head: () => ({
    meta: documentMeta(publicSeo.home, { ogType: "website" }),
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function ExplorePending() {
  return <RoutePending {...exploreShell} state={systemStates.exploreLoading} />;
}

function Home() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell {...exploreShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ExploreLanding search={search} snapshot={snapshot} />
    </AppShell>
  );
}
