import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { ReactNode, Suspense } from "react";
import {
  CreateWorkbench,
  parseCreateSearch,
} from "@/src/components/create/CreateWorkbench";

export const Route = createFileRoute("/t_/create")({
  validateSearch: parseCreateSearch,
  head: () => ({
    meta: [
      { title: "Create | NeotypeLab Terminal" },
      {
        name: "description",
        content:
          "Authenticated repaint prototype creation workflow for NeotypeLab Terminal.",
      },
    ],
  }),
  component: CreateRoute,
});

function CreateRoute() {
  const search = Route.useSearch();

  return (
    <main className="create-page">
      <AuthLoading>
        <CreateFrame>
          <section className="library-empty">
            <p className="showcase-kicker is-teal">Terminal sync</p>
            <h1>Opening create console.</h1>
            <p>
              Clerk is present and Convex is negotiating the authenticated viewer
              token.
            </p>
          </section>
        </CreateFrame>
      </AuthLoading>

      <Unauthenticated>
        <CreateFrame>
          <section className="library-empty">
            <p className="showcase-kicker is-orange">Signed out</p>
            <h1>Sign in to open the create workflow.</h1>
            <p>
              Create uses your private catalog defaults, credit balance, and
              prototype generation ledger.
            </p>
            <SignInButton mode="modal">
              <button className="showcase-button" type="button">
                Sign in
              </button>
            </SignInButton>
          </section>
        </CreateFrame>
      </Unauthenticated>

      <Authenticated>
        <Suspense
          fallback={
            <CreateFrame>
              <section className="library-empty">
                <p className="showcase-kicker is-teal">Create</p>
                <h1>Loading creation workbench.</h1>
              </section>
            </CreateFrame>
          }
        >
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </main>
  );
}

function CreateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="create-frame">
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>Create</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/t/library">
            Library
          </a>
          <a className="showcase-button" href="/showcase">
            Showcase
          </a>
        </div>
      </section>
      {children}
    </div>
  );
}
