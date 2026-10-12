import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { HomeLanding } from "@/src/components/home/HomeLanding";
import { buildHomeStructuredData } from "@/src/components/home/homeContent";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import { systemStates } from "@/src/components/system-state";
import { getHomeSnapshot, legacyArchiveRedirect } from "@/src/lib/homeRouteData";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";
import { parseShowcaseSearch } from "@/src/lib/showcaseRouteData";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

const homeShell = {
  description:
    "Spray-ready paint plans for Gunpla and mecha kits.",
  title: "Home",
} as const;

export const Route = createFileRoute("/")({
  validateSearch: parseShowcaseSearch,
  beforeLoad: ({ search }) => {
    const href = legacyArchiveRedirect(search);
    if (href) throw redirect({ href, statusCode: 301 });
  },
  loader: () => getHomeSnapshot(),
  headers: () => ({ "Cache-Control": "no-store" }),
  pendingComponent: HomePending,
  head: () => ({
    meta: documentMeta(publicSeo.home, { ogType: "website" }),
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function HomePending() {
  return <RoutePending {...homeShell} state={systemStates.exploreLoading} />;
}

function Home() {
  const snapshot = Route.useLoaderData();
  const providerStatus = useStartProviderStatus();
  const live = useQuery(api.homeFeature.getHome, providerStatus.hasConvexClient ? {} : "skip");
  const data = live ?? snapshot.data;
  const availability = useQuery(api.customKits.availability, providerStatus.hasConvexClient ? {} : "skip");
  const customKit = availability?.enabled ?? (snapshot.status === "ok" && snapshot.customKit);

  return (
    <AppShell {...homeShell} titleAsHeading={false}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeStructuredData(customKit)) }}
      />
      <HomeLanding customKit={customKit} data={data} />
    </AppShell>
  );
}
