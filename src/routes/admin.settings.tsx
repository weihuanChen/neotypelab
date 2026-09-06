import { createFileRoute } from "@tanstack/react-router";
import { SettingsWorkbench } from "@/src/components/admin/SettingsWorkbench";
import { parseAdminSettingsSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/settings")({
  validateSearch: parseAdminSettingsSearch,
  head: () => ({
    meta: [
      { title: "Settings | NeotypeLab Admin" },
      {
        name: "description",
        content: "Configure generation routing, providers, entitlement profiles, defaults, and system behavior.",
      },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return <SettingsWorkbench search={Route.useSearch()} />;
}
