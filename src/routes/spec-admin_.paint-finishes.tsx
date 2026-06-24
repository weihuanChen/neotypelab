import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/paint-finishes")({
  head: () => ({
    meta: [
      { title: "Paint Finish Specs | NeotypeLab" },
      {
        name: "description",
        content:
          "Admin-only paint finish spec calibration for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: PaintFinishesSpecAdminRoute,
});

function PaintFinishesSpecAdminRoute() {
  return <SpecAdminWorkbench section="paint-finish" />;
}
