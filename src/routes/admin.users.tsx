import { createFileRoute } from "@tanstack/react-router";
import { UserOperationsWorkbench } from "@/src/components/admin/UserOperationsWorkbench";
import { parseAdminUsersSearch } from "@/src/components/admin/adminRouteSearch";

export const Route = createFileRoute("/admin/users")({
  validateSearch: parseAdminUsersSearch,
  head: () => ({
    meta: [
      { title: "Users | NeotypeLab Admin" },
      { name: "description", content: "Review user activity, credits, feedback, and account access." },
    ],
  }),
  component: UsersRoute,
});

function UsersRoute() {
  return <UserOperationsWorkbench search={Route.useSearch()} />;
}
