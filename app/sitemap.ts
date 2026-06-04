import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: new URL("/", siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/showcase", siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const [publicConcepts, seoLandingPages, publicProfiles, creatorPacks, creatorHubs] = await Promise.all([
      fetchQuery(api.showcase.listPublicConceptsForSitemap),
      fetchQuery(api.showcase.listSeoLandingPagesForSitemap),
      fetchQuery(api.showcase.listPublicProfilesForSitemap),
      fetchQuery(api.showcase.listCreatorPacksForSitemap),
      fetchQuery(api.showcase.listCreatorHubsForSitemap),
    ]);
    return [
      ...staticRoutes,
      ...publicConcepts.map((concept) => ({
        url: new URL(`/prototype/${concept._id}`, siteUrl).toString(),
        lastModified: new Date(concept._creationTime),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...seoLandingPages.map((page) => ({
        url: new URL(`/${page.baseModelSlug}/${page.stylePresetSlug}`, siteUrl).toString(),
        lastModified: new Date(page.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...publicProfiles.map((profile) => ({
        url: new URL(`/pilot/${profile.handle}`, siteUrl).toString(),
        lastModified: new Date(profile.lastModified),
        changeFrequency: "weekly" as const,
        priority: 0.75,
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
