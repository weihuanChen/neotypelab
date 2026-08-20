import { createFileRoute } from "@tanstack/react-router";
import { TemplatesWorkbench } from "@/src/components/admin/TemplatesWorkbench";
import { parseAdminTemplatesSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/templates")({
  validateSearch: parseAdminTemplatesSearch,
  component: TemplatesRoute,
});

function TemplatesRoute() {
  return <TemplatesWorkbench search={Route.useSearch()} />;
}
