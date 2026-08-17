import { createFileRoute } from "@tanstack/react-router";
import { AuditLogWorkspace } from "@/src/components/admin/AdminDataWorkspaces";

export const Route = createFileRoute("/admin/audit-log")({ component: AuditLogWorkspace });
