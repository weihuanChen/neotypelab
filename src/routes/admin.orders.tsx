import { createFileRoute } from "@tanstack/react-router";
import { OrdersWorkspace } from "@/src/components/admin/AdminDataWorkspaces";

export const Route = createFileRoute("/admin/orders")({ component: OrdersWorkspace });
