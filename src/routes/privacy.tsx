import { createFileRoute, redirect } from "@tanstack/react-router";
import { appPaths } from "@/src/lib/appPaths";

export const Route = createFileRoute("/privacy")({
  beforeLoad: () => {
    throw redirect({
      to: appPaths.legalPrivacy,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
