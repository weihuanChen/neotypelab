import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { CreateWorkbench } from "@/src/components/create/CreateWorkbench";
import { parseCreateSearch } from "@/src/components/create/createSearch";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

export const Route = createFileRoute("/create")({
  validateSearch: parseCreateSearch,
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

function CreateRoute() {
  const search = Route.useSearch();

  return (
    <AppShell
      description="Choose a repaint language, then apply it to a kit."
      title="Create"
    >
      <AuthLoading>
        <SystemState {...systemStates.sessionLoading} />
      </AuthLoading>

      <Unauthenticated>
        <SystemState
          {...systemStates.authCreate}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>

      <Authenticated>
        <Suspense fallback={<SystemState {...systemStates.sessionLoading} />}>
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
