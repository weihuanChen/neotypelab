import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { ReactNode, Suspense } from "react";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";

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
    <main className="create-page">
      <AuthLoading>
        <AdminFrame>
          <section className="library-empty">
            <p className="showcase-kicker is-teal">Admin sync</p>
            <h1>Resolving platform clearance.</h1>
            <p>
              Clerk is present and Convex is negotiating the authenticated viewer
              token.
            </p>
          </section>
        </AdminFrame>
      </AuthLoading>

      <Unauthenticated>
        <AdminFrame>
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
        </AdminFrame>
      </Unauthenticated>

      <Authenticated>
        <AdminFrame>
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
        </AdminFrame>
      </Authenticated>
    </main>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="create-frame">
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>Admin</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/t">
            Terminal
          </a>
          <a className="showcase-button is-ghost" href="/t/feedback">
            Feedback
          </a>
          <a className="showcase-button" href="/t/library">
            Library
          </a>
        </div>
      </section>
      {children}
    </div>
  );
}
