import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/identity-locks")({
  head: () => ({
    meta: [
      { title: "Identity Locks | NeotypeLab" },
      {
        name: "description",
        content: "Admin-only identity lock calibration for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: IdentityLocksSpecAdminRoute,
});

function IdentityLocksSpecAdminRoute() {
  return <SpecAdminWorkbench section="identity-lock" />;
}
