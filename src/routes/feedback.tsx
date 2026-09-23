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
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const feedbackShell = {
  description: "Request a missing mecha kit, or report a paint plan that does not match the preview.",
  title: "Feedback",
} as const;

export const Route = createFileRoute("/feedback")({
  validateSearch: parseFeedbackSearch,
  pendingMs: 0,
  pendingComponent: FeedbackPending,
  head: () => ({
    meta: documentMeta(publicSeo.feedback, { ogType: "website" }),
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
