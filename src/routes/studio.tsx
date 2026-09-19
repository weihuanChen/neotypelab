import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { DashboardOverview } from "@/src/components/terminal/DashboardOverview";
import { noIndexRobots } from "@/src/lib/appPaths";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

const studioShell = {
  description: "Production resources and account activity.",
  title: "Studio",
} as const;

export const Route = createFileRoute("/studio")({
  pendingMs: 0,
  pendingComponent: StudioPending,
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

function StudioPending() {
  return <RoutePending {...studioShell} state={systemStates.studioLoading} />;
}

function StudioRoute() {
  const providerStatus = useStartProviderStatus();

  return (
    <AppShell {...studioShell}>
      {!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient ? (
        <SystemState
          {...systemStates.serverError}
          archive="Studio / Auth config"
          headline={"Studio needs\nClerk and Convex."}
          message={[
            "Studio cannot load private state until Clerk and Convex are present.",
          ]}
        />
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
        <SystemState {...systemStates.studioLoading} />
      </AuthLoading>
      <Unauthenticated>
        <SystemState
          {...systemStates.authStudio}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>
      <Authenticated>
        <DashboardOverview />
      </Authenticated>
    </>
  );
}
