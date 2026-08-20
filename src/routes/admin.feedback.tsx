import { createFileRoute } from "@tanstack/react-router";
import { FeedbackTriageWorkbench } from "@/src/components/admin/FeedbackTriageWorkbench";
import { parseAdminFeedbackSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/feedback")({
  validateSearch: parseAdminFeedbackSearch,
  head: () => ({
    meta: [
      { title: "Feedback Triage | NeotypeLab Admin" },
      { name: "description", content: "Review user reports, diagnose product signals, and publish resolutions." },
    ],
  }),
  component: FeedbackRoute,
});

function FeedbackRoute() {
  return <FeedbackTriageWorkbench initialReportId={Route.useSearch().report} />;
}
