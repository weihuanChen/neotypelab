import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t_/prompt-lab")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/admin/prompt-lab",
      search: location.search as never,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
