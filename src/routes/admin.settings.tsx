import { createFileRoute } from "@tanstack/react-router";
import { SettingsWorkspace } from "@/src/components/admin/AdminDataWorkspaces";

export const Route = createFileRoute("/admin/settings")({ component: SettingsWorkspace });
