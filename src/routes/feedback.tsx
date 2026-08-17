import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  FeedbackWorkbench,
  parseFeedbackSearch,
} from "@/src/components/feedback/FeedbackWorkbench";

export const Route = createFileRoute("/feedback")({
  validateSearch: parseFeedbackSearch,
  head: () => ({
    meta: [
      { title: "Feedback | NeotypeLab" },
      {
        name: "description",
        content:
          "Send model requests, generation quality reports, and paint mapping issues to the NeotypeLab triage queue.",
      },
    ],
    links: [{ rel: "canonical", href: "/feedback" }],
  }),
  component: FeedbackRoute,
});

function FeedbackRoute() {
  const search = Route.useSearch();

  return (
    <AppShell
      description="Report a model request or generation issue."
      title="Feedback"
    >
      <AuthLoading>
        <section className="feedback-loading">
          <span>Feedback</span>
          <strong>Preparing your report.</strong>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="feedback-sign-in">
          <p>Sign in to send feedback</p>
          <h2>Reports stay connected to your pilot profile.</h2>
          <span>
            Sign in to attach prototype context and follow each report from
            received to resolved.
          </span>
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
            <section className="feedback-loading">
              <span>Feedback</span>
              <strong>Preparing your report.</strong>
            </section>
          }
        >
          <FeedbackWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
