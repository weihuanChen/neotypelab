import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/materials")({
  head: () => ({
    meta: [
      { title: "Material Specs | NeotypeLab" },
      {
        name: "description",
        content: "Admin-only material spec calibration for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: MaterialsSpecAdminRoute,
});

function MaterialsSpecAdminRoute() {
  return <SpecAdminWorkbench section="material" />;
}
