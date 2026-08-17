import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t")({
  beforeLoad: () => {
    throw redirect({
      to: "/studio",
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
