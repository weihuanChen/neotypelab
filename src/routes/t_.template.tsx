import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t_/template")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/admin/templates" as never,
      search: location.search as never,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
