import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { FeedbackWorkbench } from "@/src/components/feedback/FeedbackWorkbench";
import { TerminalShell } from "@/src/components/terminal/TerminalShell";

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
    <TerminalShell
      activePath="/t/feedback"
      description="Route model requests, generation quality reports, and paint mapping issues into the admin triage queue."
      title="Feedback"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Feedback sync</p>
          <h1>Opening feedback relay.</h1>
          <p>
            Clerk is present and Convex is negotiating the authenticated viewer
            token.
          </p>
        </section>
      </AuthLoading>

      <Unauthenticated>
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
      </Unauthenticated>

      <Authenticated>
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
      </Authenticated>
    </TerminalShell>
  );
}
