import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";

export const Route = createFileRoute("/admin/prompt-lab")({ component: () => <AdminWorkbench section="prompt-lab" workspaceOnly /> });
