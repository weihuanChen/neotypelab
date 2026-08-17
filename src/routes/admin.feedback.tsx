import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";

export const Route = createFileRoute("/admin/feedback")({ component: () => <AdminWorkbench section="ops" workspaceOnly /> });
