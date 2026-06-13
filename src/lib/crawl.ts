import { api } from "@/convex/_generated/api";
import { getSiteUrl } from "@/lib/site";
import { createConvexHttpClient } from "@/src/lib/convexServer";

type SitemapFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: SitemapFrequency;
  priority: number;
};

const sitemapCacheControl =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export const sitemapHeaders = {
  "Cache-Control": sitemapCacheControl,
  "Content-Type": "application/xml; charset=utf-8",
};

export const robotsHeaders = {
  "Cache-Control": sitemapCacheControl,
  "Content-Type": "text/plain; charset=utf-8",
};

export async function buildSitemapXml(request: Request) {
  const entries = await buildSitemapEntries(request);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(toSitemapUrlXml),
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRobotsTxt(request: Request) {
  const siteUrl = getSiteUrl(request);

  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /showcase",
    "Allow: /prototype/",
    "Allow: /pilot/",
    "Disallow: /t",
    "Disallow: /t/",
    "Disallow: /api",
    "Disallow: /api/",
    "",
    `Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}`,
    `Host: ${siteUrl.origin}`,
    "",
  ].join("\n");
}

async function buildSitemapEntries(request: Request): Promise<SitemapEntry[]> {
  const siteUrl = getSiteUrl(request);
  const now = new Date();
  const staticRoutes: SitemapEntry[] = [
    {
      url: new URL("/", siteUrl).toString(),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/showcase", siteUrl).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
  const convex = createConvexHttpClient();

  if (!convex) {
    return staticRoutes;
  }

  try {
    const [
      publicConcepts,
      publicProfiles,
      seoLandingPages,
      creatorPacks,
      creatorHubs,
    ] = await Promise.all([
      convex.query(api.showcase.listPublicConceptsForSitemap, {}),
      convex.query(api.showcase.listPublicProfilesForSitemap, {}),
      convex.query(api.showcase.listSeoLandingPagesForSitemap, {}),
      convex.query(api.showcase.listCreatorPacksForSitemap, {}),
      convex.query(api.showcase.listCreatorHubsForSitemap, {}),
    ]);

    return [
      ...staticRoutes,
      ...publicConcepts.map((concept) => ({
        url: new URL(`/prototype/${concept._id}`, siteUrl).toString(),
        lastModified: new Date(concept._creationTime),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...publicProfiles.map((profile) => ({
        url: new URL(`/pilot/${profile.handle}`, siteUrl).toString(),
        lastModified: new Date(profile.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      })),
      ...seoLandingPages.map((page) => ({
        url: new URL(
          `/${page.baseModelSlug}/${page.stylePresetSlug}`,
          siteUrl
        ).toString(),
        lastModified: new Date(page.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...creatorPacks.map((pack) => ({
        url: new URL(`/creator-pack/${pack.slug}`, siteUrl).toString(),
        lastModified: new Date(pack.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.72,
      })),
      ...creatorHubs.map((hub) => ({
        url: new URL(`/creator/${hub.handle}`, siteUrl).toString(),
        lastModified: new Date(hub.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.78,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}

function toSitemapUrlXml(entry: SitemapEntry) {
  return [
    "  <url>",
    `    <loc>${escapeXml(entry.url)}</loc>`,
    `    <lastmod>${entry.lastModified.toISOString()}</lastmod>`,
    `    <changefreq>${entry.changeFrequency}</changefreq>`,
    `    <priority>${entry.priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}
