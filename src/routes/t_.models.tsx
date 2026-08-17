import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ModelCatalogWorkbench } from "@/src/components/models/ModelCatalogWorkbench";
import { noIndexRobots } from "@/src/lib/appPaths";

export const Route = createFileRoute("/t_/models")({
  head: () => ({
    meta: [
      { title: "Models | NeotypeLab" },
      {
        name: "description",
        content:
          "Admin-only model hierarchy management for IP series, base units, and kit variants.",
      },
      noIndexRobots,
    ],
  }),
  component: ModelsRoute,
});

function ModelsRoute() {
  return (
    <AppShell
      description="Admin-only model hierarchy management for IP series, base units, and kit variants."
      title="Models"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Model sync</p>
          <h1>Resolving model catalog clearance.</h1>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to manage model DNA.</h1>
          <SignInButton mode="modal">
            <button className="showcase-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </section>
      </Unauthenticated>

      <Authenticated>
        <Suspense
          fallback={
            <section className="library-empty">
              <p className="showcase-kicker is-teal">Models</p>
              <h1>Loading model hierarchy.</h1>
            </section>
          }
        >
          <ModelCatalogWorkbench />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
