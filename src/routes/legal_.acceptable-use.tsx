import { createFileRoute, redirect } from "@tanstack/react-router";
import { appPaths } from "@/src/lib/appPaths";

export const Route = createFileRoute("/legal_/acceptable-use")({
  beforeLoad: () => {
    throw redirect({
      to: appPaths.acceptableUse,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
