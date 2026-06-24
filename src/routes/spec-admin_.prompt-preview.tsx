import { createFileRoute } from "@tanstack/react-router";
import { SpecAdminWorkbench } from "@/src/components/spec-admin/SpecAdminWorkbench";

export const Route = createFileRoute("/spec-admin_/prompt-preview")({
  head: () => ({
    meta: [
      { title: "Spec Prompt Preview | NeotypeLab" },
      {
        name: "description",
        content:
          "Admin-only compiled prompt preview for calibrated NeotypeLab rendering specs.",
      },
    ],
  }),
  component: PromptPreviewSpecAdminRoute,
});

function PromptPreviewSpecAdminRoute() {
  return <SpecAdminWorkbench section="prompt-preview" />;
}
