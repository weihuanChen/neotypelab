import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/spec-admin")({
  beforeLoad: () => {
    throw redirect({
      to: "/spec-admin/materials",
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
