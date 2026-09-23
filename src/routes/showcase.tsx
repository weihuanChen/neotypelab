import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ShowcaseLanding } from "@/src/components/showcase/ShowcaseLanding";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import { systemStates } from "@/src/components/system-state";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";
import {
  buildShowcaseStructuredData,
  getShowcaseSnapshot,
  parseShowcaseSearch,
} from "@/src/lib/showcaseRouteData";

const showcaseShell = {
  description: "Community Gunpla and mecha color schemes, with the paint map behind each preview.",
  title: "Showcase",
} as const;

export const Route = createFileRoute("/showcase")({
  validateSearch: parseShowcaseSearch,
  loader: () => getShowcaseSnapshot(),
  pendingMs: 0,
  pendingComponent: ShowcasePending,
  head: () => ({
    meta: documentMeta(publicSeo.showcase, {
      ogType: "website",
      twitter: true,
      twitterCard: "summary_large_image",
    }),
    links: [{ rel: "canonical", href: "/showcase" }],
  }),
  component: ShowcaseRoute,
});

function ShowcasePending() {
  return <RoutePending {...showcaseShell} state={systemStates.showcaseLoading} />;
}

function ShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = buildShowcaseStructuredData(snapshot);

  return (
    <AppShell {...showcaseShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ShowcaseLanding search={search} snapshot={snapshot} />
    </AppShell>
  );
}
