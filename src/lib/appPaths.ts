export const appPaths = {
  explore: "/",
  showcase: "/showcase",
  styles: "/styles",
  communityStyles: "/community/styles",
  create: "/create",
  library: "/library",
  feedback: "/feedback",
  studio: "/studio",
  pricing: "/pricing",
  contact: "/contact",
  legal: "/legal",
  legalTerms: "/legal/terms",
  legalPrivacy: "/legal/privacy",
  models: "/admin/models",
  admin: "/admin",
  specAdmin: "/admin/materials",
} as const;

export type AppPath = (typeof appPaths)[keyof typeof appPaths];

/** Public /styles gallery is parked until the collection is ready to ship. */
export const publicStylesEnabled = false;

export const noIndexRobots = { name: "robots", content: "noindex, nofollow" } as const;

export function buildCreateHref(
  params: Record<string, string | undefined | null> = {}
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `${appPaths.create}?${query}` : appPaths.create;
}
