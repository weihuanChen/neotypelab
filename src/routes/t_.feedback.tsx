import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { ReactNode, Suspense } from "react";
import { FeedbackWorkbench } from "@/src/components/feedback/FeedbackWorkbench";

export const Route = createFileRoute("/t_/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback | NeotypeLab Terminal" },
      {
        name: "description",
        content:
          "Authenticated feedback relay for model requests, generation quality reports, and paint mapping issues.",
      },
    ],
  }),
  component: FeedbackRoute,
});

function FeedbackRoute() {
  return (
    <main className="create-page">
      <AuthLoading>
        <FeedbackFrame>
          <section className="library-empty">
            <p className="showcase-kicker is-teal">Feedback sync</p>
            <h1>Opening feedback relay.</h1>
            <p>
              Clerk is present and Convex is negotiating the authenticated viewer
              token.
            </p>
          </section>
        </FeedbackFrame>
      </AuthLoading>

      <Unauthenticated>
        <FeedbackFrame>
          <section className="library-empty">
            <p className="showcase-kicker is-orange">Signed out</p>
            <h1>Sign in to route feedback.</h1>
            <p>
              Feedback reports are tied to your operator profile and routed into
              the admin triage queue.
            </p>
            <SignInButton mode="modal">
              <button className="showcase-button" type="button">
                Sign in
              </button>
            </SignInButton>
          </section>
        </FeedbackFrame>
      </Unauthenticated>

      <Authenticated>
        <FeedbackFrame>
          <Suspense
            fallback={
              <section className="library-empty">
                <p className="showcase-kicker is-teal">Feedback</p>
                <h1>Loading feedback workbench.</h1>
              </section>
            }
          >
            <FeedbackWorkbench />
          </Suspense>
        </FeedbackFrame>
      </Authenticated>
    </main>
  );
}

function FeedbackFrame({ children }: { children: ReactNode }) {
  return (
    <div className="create-frame">
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>Feedback</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/t">
            Terminal
          </a>
          <a className="showcase-button is-ghost" href="/t/create">
            Create
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
