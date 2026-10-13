import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { CreateWorkbench } from "@/src/components/create/CreateWorkbench";
import { CreateIntro } from "@/src/components/create/CreateIntro";
import { parseCreateSearch } from "@/src/components/create/createSearch";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const createShell = {
  description: "Describe a color scheme, upload your kit or pick one from the catalog, and preview the result with a paint plan.",
  title: "Plan a custom paint job",
} as const;

export const Route = createFileRoute("/create")({
  validateSearch: parseCreateSearch,
  pendingComponent: CreatePending,
  head: () => ({
    meta: documentMeta(publicSeo.create, { ogType: "website" }),
    links: [{ rel: "canonical", href: "/create" }],
  }),
  component: CreateRoute,
});

function CreatePending() {
  return <RoutePending {...createShell} state={systemStates.createLoading} />;
}

function CreateRoute() {
  const search = Route.useSearch();

  return (
    <AppShell {...createShell}>
      <AuthLoading>
        <SystemState {...systemStates.createLoading} />
      </AuthLoading>

      <Unauthenticated>
        <SystemState
          {...systemStates.authCreate}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
        <CreateIntro />
      </Unauthenticated>

      <Authenticated>
        <Suspense fallback={<SystemState {...systemStates.createLoading} />}>
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
