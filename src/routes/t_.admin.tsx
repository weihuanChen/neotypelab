import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";
import { TerminalShell } from "@/src/components/terminal/TerminalShell";

export const Route = createFileRoute("/t_/admin")({
  head: () => ({
    meta: [
      { title: "Admin | NeotypeLab Terminal" },
      {
        name: "description",
        content:
          "Platform administration surface for NeotypeLab prompt templates, catalog data, feedback triage, users, and credits.",
      },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <TerminalShell
      activePath="/t/admin"
      description="Platform administration for prompt templates, catalog data, feedback triage, users, and credit operations."
      title="Admin"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Admin sync</p>
          <h1>Resolving platform clearance.</h1>
          <p>
            Clerk is present and Convex is negotiating the authenticated viewer
            token.
          </p>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open the admin terminal.</h1>
          <p>
            Admin actions require a Clerk session and a Convex viewer with
            platform management clearance.
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
              <p className="showcase-kicker is-teal">Admin</p>
              <h1>Loading admin workbench.</h1>
            </section>
          }
        >
          <AdminWorkbench />
        </Suspense>
      </Authenticated>
    </TerminalShell>
  );
}
