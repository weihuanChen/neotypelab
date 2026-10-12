import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml, sitemapHeaders } from "@/src/lib/crawl";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => sitemapResponse(request),
      HEAD: ({ request }) => sitemapResponse(request, true),
    },
  },
});

async function sitemapResponse(request: Request, head = false) {
  try {
    const xml = await buildSitemapXml(request);
    return new Response(head ? null : xml, { headers: sitemapHeaders });
  } catch {
    return new Response(head ? null : "Sitemap temporarily unavailable", {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}
