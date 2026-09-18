import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackReportDetail } from "@/src/components/feedback/FeedbackReports";
import {
  SystemSignInButton,
  SystemSignInLink,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

export const Route = createFileRoute("/feedback_/$feedbackId")({
  head: () => ({ meta: [{ title: "Feedback Report | NeotypeLab" }] }),
  component: FeedbackReportRoute,
});

function FeedbackReportRoute() {
  const { feedbackId } = Route.useParams();
  return (
    <AppShell description="Review report details and status." title="Feedback record">
      <AuthLoading>
        <SystemState {...systemStates.sessionLoading} />
      </AuthLoading>
      <Unauthenticated>
        <SystemState
          {...systemStates.authRecord}
          archive="Feedback / Private record"
          headline={"This report\nis private."}
          primary={<SystemSignInButton />}
          secondary={<SystemSignInLink />}
        />
      </Unauthenticated>
      <Authenticated><FeedbackReportDetail feedbackId={feedbackId} /></Authenticated>
    </AppShell>
  );
}
