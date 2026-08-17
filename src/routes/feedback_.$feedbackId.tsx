import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackReportDetail } from "@/src/components/feedback/FeedbackReports";

export const Route = createFileRoute("/feedback_/$feedbackId")({
  head: () => ({ meta: [{ title: "Feedback Report | NeotypeLab" }] }),
  component: FeedbackReportRoute,
});

function FeedbackReportRoute() {
  const { feedbackId } = Route.useParams();
  return (
    <AppShell description="Review report details and status." title="Feedback record">
      <AuthLoading><section className="feedback-loading"><strong>Opening report record.</strong></section></AuthLoading>
      <Unauthenticated>
        <section className="feedback-sign-in">
          <p>Session required</p>
          <h2>Sign in to open this report.</h2>
          <SignInButton mode="modal"><button className="showcase-button" type="button">Sign in</button></SignInButton>
        </section>
      </Unauthenticated>
      <Authenticated><FeedbackReportDetail feedbackId={feedbackId} /></Authenticated>
    </AppShell>
  );
}
