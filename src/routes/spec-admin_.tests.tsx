import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/tests")({
  head: () => ({
    meta: [
      { title: "Spec Tests | NeotypeLab" },
      {
        name: "description",
        content:
          "Admin-only spec prompt test record management for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: SpecTestsAdminRoute,
});

function SpecTestsAdminRoute() {
  return <SpecAdminWorkbench section="tests" />;
}
