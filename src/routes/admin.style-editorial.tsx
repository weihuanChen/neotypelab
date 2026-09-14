import { createFileRoute } from "@tanstack/react-router";
import { StyleEditorialWorkbench } from "@/src/components/admin/StyleEditorialWorkbench";
export const Route = createFileRoute("/admin/style-editorial")({ component: StyleEditorialWorkbench });
