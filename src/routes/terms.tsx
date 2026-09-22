import { createFileRoute, redirect } from "@tanstack/react-router";
import { appPaths } from "@/src/lib/appPaths";

export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    throw redirect({
      to: appPaths.legalTerms,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
