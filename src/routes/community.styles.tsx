import { createFileRoute, notFound } from "@tanstack/react-router";
import { noIndexRobots } from "@/src/lib/appPaths";

// Community discovery stays closed until the public collection is ready.
export const Route = createFileRoute("/community/styles")({
  beforeLoad: () => { throw notFound(); },
  head: () => ({ meta: [noIndexRobots] }),
});
