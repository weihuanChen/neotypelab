import { createFileRoute } from "@tanstack/react-router";
import { PaintCatalogWorkbench } from "@/src/components/admin/PaintCatalogWorkbench";

export const Route = createFileRoute("/admin/paints")({ component: PaintCatalogWorkbench });
