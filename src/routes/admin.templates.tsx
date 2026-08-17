import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkbench } from "@/src/components/admin/AdminWorkbench";

export const Route = createFileRoute("/admin/templates")({ component: () => <AdminWorkbench section="templates" workspaceOnly /> });
