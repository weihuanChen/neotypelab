import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";
import { AdminShell } from "@/src/components/admin/AdminShell";
import { noIndexRobots } from "@/src/lib/appPaths";

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
      <AuthLoading><AdminGate title="Resolving platform clearance." /></AuthLoading>
      <Unauthenticated>
        <AdminGate title="Sign in to open the admin console.">
          <SignInButton mode="modal"><button className="showcase-button" type="button">Sign in</button></SignInButton>
        </AdminGate>
      </Unauthenticated>
      <Authenticated><AdminShell><Outlet /></AdminShell></Authenticated>
    </>
  );
}

function AdminGate({ children, title }: { children?: ReactNode; title: string }) {
  return <main className="admin-gate"><p>NeotypeLab Admin</p><h1>{title}</h1>{children}</main>;
}
