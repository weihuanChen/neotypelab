import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseCreateSearch } from "@/src/components/create/createSearch";

export const Route = createFileRoute("/t_/create")({
  validateSearch: parseCreateSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/create",
      search,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
