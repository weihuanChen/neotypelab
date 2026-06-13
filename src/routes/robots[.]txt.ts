import { createFileRoute } from "@tanstack/react-router";
import { buildRobotsTxt, robotsHeaders } from "@/src/lib/crawl";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(buildRobotsTxt(request), {
          headers: robotsHeaders,
        }),
      HEAD: () =>
        new Response(null, {
          headers: robotsHeaders,
        }),
    },
  },
});
