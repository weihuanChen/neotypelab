import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseShowcaseSearch } from "@/src/lib/showcaseRouteData";

export const Route = createFileRoute("/t_/showcase")({
  validateSearch: parseShowcaseSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/showcase",
      search,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
