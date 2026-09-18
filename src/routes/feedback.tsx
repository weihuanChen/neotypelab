import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackWorkbench } from "@/src/components/feedback/FeedbackWorkbench";
import { parseFeedbackSearch } from "@/src/components/feedback/feedbackUtils";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

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
        <SystemState {...systemStates.sessionLoading} />
      </AuthLoading>

      <Unauthenticated>
        <SystemState
          {...systemStates.authFeedback}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>

      <Authenticated>
        <Suspense fallback={<SystemState {...systemStates.sessionLoading} />}>
          <FeedbackWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
