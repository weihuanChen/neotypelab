import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { DashboardOverview } from "@/src/components/terminal/DashboardOverview";
import { noIndexRobots } from "@/src/lib/appPaths";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio | NeotypeLab" },
      {
        name: "description",
        content:
          "Production resources, spray plans, paint inventory, credits, and orders.",
      },
      noIndexRobots,
    ],
  }),
  component: StudioRoute,
});

function StudioRoute() {
  const providerStatus = useStartProviderStatus();

  return (
    <AppShell
      description="Production resources and account activity."
      title="Studio"
    >
      {!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient ? (
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Auth config</p>
          <h1>Studio needs Clerk and Convex before it can load private state.</h1>
        </section>
      ) : (
        <StudioAuthGate />
      )}
    </AppShell>
  );
}

function StudioAuthGate() {
  return (
    <>
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Session sync</p>
          <h1>Opening studio.</h1>
        </section>
      </AuthLoading>
      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open your studio.</h1>
          <SignInButton mode="modal">
            <button className="showcase-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </section>
      </Unauthenticated>
      <Authenticated>
        <DashboardOverview />
      </Authenticated>
    </>
  );
}
