import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t_/models")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/models" as never, replace: true });
  },
  component: () => null,
});
