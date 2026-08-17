import { createFileRoute } from "@tanstack/react-router";
import { AdminOverview } from "@/src/components/admin/AdminOverview";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });
