import {
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/tanstack-react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

const getAuthSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const hasClerkEnv = Boolean(
    (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      process.env.CLERK_PUBLISHABLE_KEY ??
      process.env.VITE_CLERK_PUBLISHABLE_KEY) &&
      process.env.CLERK_SECRET_KEY
  );

  if (!hasClerkEnv) {
    return {
      status: "missing-env" as const,
      userId: null,
      message:
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required for protected SSR auth.",
    };
  }

  try {
    const authState = await auth();

    return {
      status: "ok" as const,
      userId: authState.userId,
      sessionId: authState.sessionId,
      signedIn: Boolean(authState.userId),
    };
  } catch (error) {
    return {
      status: "error" as const,
      userId: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

export const Route = createFileRoute("/t")({
  loader: () => getAuthSnapshot(),
  head: () => ({
    meta: [
      { title: "Terminal Auth | NeotypeLab TanStack Spike" },
      {
        name: "description",
        content:
          "Clerk and Convex authenticated app-shell probe for the TanStack Start migration.",
      },
    ],
  }),
  component: TerminalSpike,
});

function TerminalSpike() {
  const authSnapshot = Route.useLoaderData();
  const providerStatus = useStartProviderStatus();

  return (
    <main className="spike-page">
      <section className="spike-hero spike-hero--short">
        <p className="spike-kicker">Authenticated shell probe</p>
        <h1>Terminal route is mounted in TanStack Start.</h1>
        <p>
          Server auth status: <strong>{authSnapshot.status}</strong>
          {"signedIn" in authSnapshot
            ? ` / ${authSnapshot.signedIn ? "signed in" : "signed out"}`
            : ""}
        </p>
      </section>

      <section className="spike-grid">
        <article className="spike-panel">
          <p className="spike-kicker">Clerk</p>
          <h2>
            {providerStatus.hasClerkProvider
              ? "Client provider configured"
              : "Client provider missing"}
          </h2>
          {providerStatus.hasClerkProvider ? (
            <ClerkClientPanel />
          ) : (
            <p>
              Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to enable client-side
              Clerk controls.
            </p>
          )}
        </article>

        <article className="spike-panel">
          <p className="spike-kicker">Convex</p>
          <h2>
            {providerStatus.hasConvexClient
              ? "Realtime client configured"
              : "Realtime client missing"}
          </h2>
          {providerStatus.hasClerkProvider && providerStatus.hasConvexClient ? (
            <AuthenticatedViewerProbe />
          ) : (
            <p>
              Set `NEXT_PUBLIC_CONVEX_URL` and sign in to verify `api.users.viewer`.
            </p>
          )}
        </article>

        <article className="spike-panel">
          <p className="spike-kicker">Server snapshot</p>
          <h2>Route loader output</h2>
          <pre className="spike-code">
            {JSON.stringify(authSnapshot, null, 2)}
          </pre>
        </article>
      </section>
    </main>
  );
}

function ClerkClientPanel() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <p>Loading Clerk...</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="spike-auth-actions">
        <SignInButton mode="modal">
          <button className="spike-button" type="button">
            Sign in
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="spike-auth-actions">
      <UserButton />
      <p>Signed in on the client.</p>
    </div>
  );
}

function AuthenticatedViewerProbe() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <p>Waiting for Clerk before opening Convex...</p>;
  }

  if (!isSignedIn) {
    return <p>Sign in to verify the Convex viewer query.</p>;
  }

  return <ViewerProbe />;
}

function ViewerProbe() {
  const viewer = useQuery(api.users.viewer);
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (viewer === null) {
      void storeUser();
    }
  }, [storeUser, viewer]);

  if (viewer === undefined) {
    return <p>Loading Convex viewer...</p>;
  }

  if (viewer === null) {
    return <p>Creating viewer record in Convex...</p>;
  }

  return (
    <dl className="spike-facts">
      <div>
        <dt>Handle</dt>
        <dd>{viewer.handle}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{viewer.email}</dd>
      </div>
      <div>
        <dt>Credits</dt>
        <dd>{viewer.credits.balance}</dd>
      </div>
    </dl>
  );
}
