import { createFileRoute } from "@tanstack/react-router";
import { ModelCatalogWorkbench } from "@/src/components/models/ModelCatalogWorkbench";

export const Route = createFileRoute("/admin/models")({ component: ModelCatalogWorkbench });
