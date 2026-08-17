import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t_/feedback")({
  beforeLoad: () => {
    throw redirect({
      to: "/feedback",
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
