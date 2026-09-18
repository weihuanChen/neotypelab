import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { AdminShell } from "@/src/components/admin/AdminShell";
import { noIndexRobots } from "@/src/lib/appPaths";
import {
  SystemSignInButton,
  SystemState,
  systemStates,
} from "@/src/components/system-state";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console | NeotypeLab" },
      { name: "description", content: "NeotypeLab platform operations and system configuration." },
      noIndexRobots,
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <>
      <AuthLoading>
        <SystemState {...systemStates.sessionLoading} layout="page" />
      </AuthLoading>
      <Unauthenticated>
        <SystemState
          {...systemStates.authAdmin}
          layout="page"
          primary={<SystemSignInButton />}
        />
      </Unauthenticated>
      <Authenticated><AdminShell><Outlet /></AdminShell></Authenticated>
    </>
  );
}
