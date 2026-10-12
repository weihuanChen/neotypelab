import { createFileRoute } from "@tanstack/react-router";
import { HomeCurationWorkbench } from "@/src/components/admin/HomeCurationWorkbench";

export const Route = createFileRoute("/admin/home")({ component: HomeCurationWorkbench });
