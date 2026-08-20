import { createFileRoute } from "@tanstack/react-router";
import { PromptLabWorkbench } from "@/src/components/admin/PromptLabWorkbench";
import { parseAdminPromptLabSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/prompt-lab")({
  validateSearch: parseAdminPromptLabSearch,
  component: PromptLabRoute,
});

function PromptLabRoute() {
  return <PromptLabWorkbench search={Route.useSearch()} />;
}
