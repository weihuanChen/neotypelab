import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { DashboardOverview } from "@/src/components/terminal/DashboardOverview";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

export const Route = createFileRoute("/t")({
  head: () => ({
    meta: [
      { title: "Terminal | NeotypeLab" },
      {
        name: "description",
        content:
          "Authenticated NeotypeLab operator terminal for create, library, credits, and generation state.",
      },
    ],
  }),
  component: TerminalRoute,
});

function TerminalRoute() {
  const providerStatus = useStartProviderStatus();

  return (
    <main className="terminal-page">
      <section className="terminal-hero">
        <p className="showcase-kicker">NeotypeLab Terminal</p>
        <h1>Operate the repaint pipeline.</h1>
        <p>
          Create structured concepts, manage generated surfaces, review credits,
          and keep public-ready builds synchronized with Convex.
        </p>
        <div className="terminal-actions">
          <a className="showcase-button" href="/t/create">
            Create
          </a>
          <a className="showcase-button is-ghost" href="/t/library">
            Library
          </a>
          <a className="showcase-button is-ghost" href="/showcase">
            Showcase
          </a>
        </div>
      </section>

      {!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient ? (
        <MissingAuthConfiguration providerStatus={providerStatus} />
      ) : (
        <TerminalAuthGate />
      )}
    </main>
  );
}

function TerminalAuthGate() {
  return (
    <div className="terminal-stack">
      <AuthLoading>
        <TerminalStatePanel
          copy="Clerk is present and Convex is negotiating the authenticated viewer token."
          kicker="Session sync"
          title="Opening operator terminal"
        />
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open the operator terminal.</h1>
          <p>
            Terminal data is scoped to your Clerk identity and private Convex
            viewer record.
          </p>
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
      <TerminalStatePanel
        copy={
          providerStatus.hasClerkProvider
            ? "Clerk publishable key is available."
            : "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY for client auth."
        }
        kicker={providerStatus.hasClerkProvider ? "Ready" : "Missing"}
        title="Clerk provider"
      />
      <TerminalStatePanel
        copy={
          providerStatus.hasConvexClient
            ? "Convex client URL is available."
            : "Set NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL for realtime Convex access."
        }
        kicker={providerStatus.hasConvexClient ? "Ready" : "Missing"}
        title="Convex client"
      />
      <TerminalStatePanel
        copy="Both providers are required before authenticated terminal routes can query private viewer state."
        kicker={providerStatus.hasConvexAuthBridge ? "Ready" : "Blocked"}
        title="Convex auth bridge"
      />
    </section>
  );
}

function TerminalStatePanel({
  copy,
  kicker,
  title,
}: {
  copy: string;
  kicker: string;
  title: string;
}) {
  return (
    <article className="library-panel terminal-panel">
      <p className="showcase-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}
