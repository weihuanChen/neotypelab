import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseLibrarySearch } from "@/src/components/library/librarySearch";

export const Route = createFileRoute("/t_/library")({
  validateSearch: parseLibrarySearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/library",
      search,
      replace: true,
      statusCode: 301,
    });
  },
  component: () => null,
});
