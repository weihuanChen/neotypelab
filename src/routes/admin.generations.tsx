import { createFileRoute } from "@tanstack/react-router";
import { GenerationLogsWorkspace } from "@/src/components/admin/AdminDataWorkspaces";

export const Route = createFileRoute("/admin/generations")({ component: GenerationLogsWorkspace });
