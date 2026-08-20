import { createFileRoute } from "@tanstack/react-router";
import { GenerationLogsWorkspace } from "@/src/components/admin/AdminDataWorkspaces";
import { parseAdminGenerationsSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/generations")({
  validateSearch: parseAdminGenerationsSearch,
  component: GenerationRoute,
});

function GenerationRoute() {
  return <GenerationLogsWorkspace initialRunId={Route.useSearch().run} />;
}
