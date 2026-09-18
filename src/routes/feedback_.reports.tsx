import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackReportsList } from "@/src/components/feedback/FeedbackReports";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

export const Route = createFileRoute("/feedback_/reports")({
  head: () => ({ meta: [{ title: "My Reports | NeotypeLab" }] }),
  component: FeedbackReportsRoute,
});

function FeedbackReportsRoute() {
  return (
    <AppShell description="Track submitted feedback and review status." title="My reports">
      <AuthLoading>
        <SystemState {...systemStates.sessionLoading} />
      </AuthLoading>
      <Unauthenticated>
        <SystemState
          {...systemStates.authFeedback}
          archive="Feedback / Report archive"
          headline={"Your reports\nare private."}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>
      <Authenticated><FeedbackReportsList /></Authenticated>
    </AppShell>
  );
}
