import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml, sitemapHeaders } from "@/src/lib/crawl";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(await buildSitemapXml(request), {
          headers: sitemapHeaders,
        }),
      HEAD: async () =>
        new Response(null, {
          headers: sitemapHeaders,
        }),
    },
  },
});
