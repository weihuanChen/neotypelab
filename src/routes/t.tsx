import {
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/tanstack-react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

type AuthSnapshot =
  | {
      status: "ok";
      sessionId: string | null;
      signedIn: boolean;
      userId: string | null;
    }
  | {
      status: "missing-env" | "error";
      message: string;
      userId: null;
    };

const getAuthSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthSnapshot> => {
    const hasClerkEnv = Boolean(
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        process.env.CLERK_PUBLISHABLE_KEY ??
        process.env.VITE_CLERK_PUBLISHABLE_KEY) &&
        process.env.CLERK_SECRET_KEY
    );

    if (!hasClerkEnv) {
      return {
        status: "missing-env",
        userId: null,
        message:
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required for protected SSR auth.",
      };
    }

    try {
      const authState = await auth();

      return {
        status: "ok",
        userId: authState.userId,
        sessionId: authState.sessionId,
        signedIn: Boolean(authState.userId),
      };
    } catch {
      return {
        status: "error",
        userId: null,
        message:
          "Clerk server auth could not be resolved for this TanStack route.",
      };
    }
  }
);

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
  component: TerminalAuthRoute,
});

function TerminalAuthRoute() {
  const authSnapshot = Route.useLoaderData();
  const providerStatus = useStartProviderStatus();

  return (
    <main className="spike-page auth-page">
      <section className="spike-hero spike-hero--short auth-hero">
        <p className="spike-kicker">Authenticated shell</p>
        <h1>Clerk React and Convex auth are wired into TanStack Start.</h1>
        <p>
          Server auth status: <strong>{authSnapshot.status}</strong>
          {"signedIn" in authSnapshot
            ? ` / ${authSnapshot.signedIn ? "signed in" : "signed out"}`
            : ""}
        </p>
      </section>

      {!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient ? (
        <MissingAuthConfiguration providerStatus={providerStatus} />
      ) : (
        <TerminalAuthGate authSnapshot={authSnapshot} />
      )}
    </main>
  );
}

function TerminalAuthGate({
  authSnapshot,
}: {
  authSnapshot: AuthSnapshot;
}) {
  return (
    <div className="auth-stack">
      <AuthLoading>
        <AuthStatePanel
          copy="Clerk is present and Convex is negotiating an authenticated websocket token."
          status="Syncing"
          title="Waiting for Convex auth"
        />
      </AuthLoading>

      <Unauthenticated>
        <SignedOutPanel authSnapshot={authSnapshot} />
      </Unauthenticated>

      <Authenticated>
        <SignedInPanel authSnapshot={authSnapshot} />
      </Authenticated>
    </div>
  );
}

function MissingAuthConfiguration({
  providerStatus,
}: {
  providerStatus: ReturnType<typeof useStartProviderStatus>;
}) {
  return (
    <section className="auth-grid">
      <AuthStatePanel
        copy={
          providerStatus.hasClerkProvider
            ? "Clerk publishable key is available."
            : "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY for client auth."
        }
        status={providerStatus.hasClerkProvider ? "Ready" : "Missing"}
        title="Clerk provider"
      />
      <AuthStatePanel
        copy={
          providerStatus.hasConvexClient
            ? "Convex client URL is available."
            : "Set NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL for realtime Convex access."
        }
        status={providerStatus.hasConvexClient ? "Ready" : "Missing"}
        title="Convex client"
      />
      <AuthStatePanel
        copy="Both providers are required before authenticated terminal routes can query api.users.viewer."
        status={providerStatus.hasConvexAuthBridge ? "Ready" : "Blocked"}
        title="Convex auth bridge"
      />
    </section>
  );
}

function SignedOutPanel({ authSnapshot }: { authSnapshot: AuthSnapshot }) {
  return (
    <section className="auth-grid">
      <article className="spike-panel auth-panel auth-panel--primary">
        <p className="spike-kicker">Signed out</p>
        <h2>Sign in to open the operator surface.</h2>
        <p>
          Clerk controls are mounted, but Convex queries will stay unauthenticated
          until a session token is available.
        </p>
        <div className="spike-auth-actions">
          <SignInButton mode="modal">
            <button className="spike-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </div>
      </article>
      <ServerSnapshotPanel authSnapshot={authSnapshot} />
    </section>
  );
}

function SignedInPanel({ authSnapshot }: { authSnapshot: AuthSnapshot }) {
  const { user } = useUser();

  return (
    <section className="auth-grid auth-grid--signed-in">
      <article className="spike-panel auth-panel auth-panel--primary">
        <p className="spike-kicker">Clerk session</p>
        <h2>{user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Signed in"}</h2>
        <div className="auth-user-row">
          <UserButton />
          <div>
            <strong>{user?.username ? `@${user.username}` : "Client session active"}</strong>
            <span>{user?.primaryEmailAddress?.emailAddress ?? "Email unavailable"}</span>
          </div>
        </div>
      </article>
      <ViewerProbe />
      <ServerSnapshotPanel authSnapshot={authSnapshot} />
    </section>
  );
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
    return (
      <AuthStatePanel
        copy="Waiting for api.users.viewer after Clerk issued the Convex JWT."
        status="Loading"
        title="Convex viewer"
      />
    );
  }

  if (viewer === null) {
    return (
      <AuthStatePanel
        copy="The provider is creating or refreshing the user record through api.users.store."
        status="Creating"
        title="Convex viewer"
      />
    );
  }

  return (
    <article className="spike-panel auth-panel">
      <p className="spike-kicker">Convex viewer</p>
      <h2>{viewer.fullName}</h2>
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
          <dt>Plan</dt>
          <dd>{viewer.planType}</dd>
        </div>
        <div>
          <dt>Credits</dt>
          <dd>{viewer.credits.balance}</dd>
        </div>
        <div>
          <dt>Admin</dt>
          <dd>{viewer.canManagePlatform ? "enabled" : "standard"}</dd>
        </div>
      </dl>
    </article>
  );
}

function ServerSnapshotPanel({ authSnapshot }: { authSnapshot: AuthSnapshot }) {
  return (
    <article className="spike-panel auth-panel">
      <p className="spike-kicker">Server snapshot</p>
      <h2>Route loader output</h2>
      <pre className="spike-code">
        {JSON.stringify(authSnapshot, null, 2)}
      </pre>
    </article>
  );
}

function AuthStatePanel({
  copy,
  status,
  title,
}: {
  copy: string;
  status: string;
  title: string;
}) {
  return (
    <article className="spike-panel auth-panel">
      <p className="spike-kicker">{status}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}
