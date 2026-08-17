import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { FeedbackReportsList } from "@/src/components/feedback/FeedbackReports";

export const Route = createFileRoute("/feedback_/reports")({
  head: () => ({ meta: [{ title: "My Reports | NeotypeLab" }] }),
  component: FeedbackReportsRoute,
});

function FeedbackReportsRoute() {
  return (
    <AppShell description="Track submitted feedback and review status." title="My reports">
      <AuthLoading><section className="feedback-loading"><strong>Loading report archive.</strong></section></AuthLoading>
      <Unauthenticated>
        <section className="feedback-sign-in">
          <p>Session required</p>
          <h2>Sign in to open your report archive.</h2>
          <SignInButton mode="modal"><button className="showcase-button" type="button">Sign in</button></SignInButton>
        </section>
      </Unauthenticated>
      <Authenticated><FeedbackReportsList /></Authenticated>
    </AppShell>
  );
}
