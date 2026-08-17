import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { noIndexRobots } from "@/src/lib/appPaths";

export const Route = createFileRoute("/t_/admin")({
  head: () => ({
    meta: [
      { title: "Admin | NeotypeLab" },
      {
        name: "description",
        content:
          "Platform administration surface for NeotypeLab prompt templates, catalog data, feedback triage, users, and credits.",
      },
      noIndexRobots,
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AppShell
      description="Platform administration for prompt templates, catalog data, feedback triage, users, and credit operations."
      title="Admin"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Admin sync</p>
          <h1>Resolving platform clearance.</h1>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open the admin terminal.</h1>
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
    </AppShell>
  );
}
