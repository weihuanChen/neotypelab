import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import {
  CreateWorkbench,
  parseCreateSearch,
} from "@/src/components/create/CreateWorkbench";
import { TerminalShell } from "@/src/components/terminal/TerminalShell";

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
    <TerminalShell
      activePath="/t/create"
      description="Authenticated repaint prototype creation workflow with catalog defaults, credit checks, and remix seeding."
      title="Create"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Terminal sync</p>
          <h1>Opening create console.</h1>
          <p>
            Clerk is present and Convex is negotiating the authenticated viewer
            token.
          </p>
        </section>
      </AuthLoading>

      <Unauthenticated>
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
      </Unauthenticated>

      <Authenticated>
        <Suspense
          fallback={
            <section className="library-empty">
              <p className="showcase-kicker is-teal">Create</p>
              <h1>Loading creation workbench.</h1>
            </section>
          }
        >
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </TerminalShell>
  );
}
