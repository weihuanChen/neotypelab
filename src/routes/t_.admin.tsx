import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t_/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" as never, replace: true });
  },
  component: () => null,
});
