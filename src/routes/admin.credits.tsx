import { createFileRoute } from "@tanstack/react-router";
import { CreditsMonetizationWorkbench } from "@/src/components/admin/CreditsMonetizationWorkbench";
import { parseAdminCreditsSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/credits")({
  validateSearch: parseAdminCreditsSearch,
  head: () => ({
    meta: [
      { title: "Credits & Rewards | NeotypeLab Admin" },
      {
        name: "description",
        content: "Operate credit circulation, rewards campaigns, pricing, and transaction history.",
      },
    ],
  }),
  component: CreditsRoute,
});

function CreditsRoute() {
  return <CreditsMonetizationWorkbench search={Route.useSearch()} />;
}
