import { createFileRoute } from "@tanstack/react-router";
import { CreatorPackWorkbench } from "@/src/components/admin/CreatorPackWorkbench";

export const Route = createFileRoute("/admin/creator-packs")({ component: CreatorPackWorkbench });
