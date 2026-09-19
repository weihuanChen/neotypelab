import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { CreateWorkbench } from "@/src/components/create/CreateWorkbench";
import { parseCreateSearch } from "@/src/components/create/createSearch";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

const createShell = {
  description: "Choose a repaint language, then apply it to a kit.",
  title: "Create",
} as const;

export const Route = createFileRoute("/create")({
  validateSearch: parseCreateSearch,
  pendingMs: 0,
  pendingComponent: CreatePending,
  head: () => ({
    meta: [
      { title: "Create | NeotypeLab" },
      {
        name: "description",
        content:
          "Prototype spray-ready mecha repaint concepts with structured Style DNA, material presets, and credit-aware generation.",
      },
      { property: "og:title", content: "Create | NeotypeLab" },
      {
        property: "og:description",
        content:
          "Prototype spray-ready mecha repaint concepts with structured Style DNA, material presets, and credit-aware generation.",
      },
      { property: "og:type", content: "website" },
    ],
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
      </Unauthenticated>

      <Authenticated>
        <Suspense fallback={<SystemState {...systemStates.createLoading} />}>
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
