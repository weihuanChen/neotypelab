import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/styles")({
  head: () => ({
    meta: [
      { title: "Style Specs | NeotypeLab" },
      {
        name: "description",
        content: "Admin-only style spec calibration for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: StylesSpecAdminRoute,
});

function StylesSpecAdminRoute() {
  return <SpecAdminWorkbench section="style" />;
}
