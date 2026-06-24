import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/weathering")({
  head: () => ({
    meta: [
      { title: "Weathering Specs | NeotypeLab" },
      {
        name: "description",
        content: "Admin-only weathering spec calibration for NeotypeLab Rendering Pipeline V2.",
      },
    ],
  }),
  component: WeatheringSpecAdminRoute,
});

function WeatheringSpecAdminRoute() {
  return <SpecAdminWorkbench section="weathering" />;
}
