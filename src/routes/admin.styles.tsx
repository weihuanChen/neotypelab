import { createFileRoute } from "@tanstack/react-router";
import { StyleLibraryWorkbench } from "@/src/components/admin/StyleLibraryWorkbench";

export const Route = createFileRoute("/admin/styles")({ component: StyleLibraryWorkbench });
