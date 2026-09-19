import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackWorkbench } from "@/src/components/feedback/FeedbackWorkbench";
import { parseFeedbackSearch } from "@/src/components/feedback/feedbackUtils";
import { RoutePending } from "@/src/components/system-state/RoutePending";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

const feedbackShell = {
  description: "Report a model request or generation issue.",
  title: "Feedback",
} as const;

export const Route = createFileRoute("/feedback")({
  validateSearch: parseFeedbackSearch,
  pendingMs: 0,
  pendingComponent: FeedbackPending,
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

function FeedbackPending() {
  return <RoutePending {...feedbackShell} state={systemStates.feedbackLoading} />;
}

function FeedbackRoute() {
  const search = Route.useSearch();

  return (
    <AppShell {...feedbackShell}>
      <AuthLoading>
        <SystemState {...systemStates.feedbackLoading} />
      </AuthLoading>

      <Unauthenticated>
        <SystemState
          {...systemStates.authFeedback}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>

      <Authenticated>
        <Suspense fallback={<SystemState {...systemStates.feedbackLoading} />}>
          <FeedbackWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
