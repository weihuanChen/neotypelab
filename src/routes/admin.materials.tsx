import { createFileRoute } from "@tanstack/react-router";
import { MaterialLibraryWorkbench } from "@/src/components/admin/MaterialLibraryWorkbench";

export const Route = createFileRoute("/admin/materials")({ component: MaterialLibraryWorkbench });
