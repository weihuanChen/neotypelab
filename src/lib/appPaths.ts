export const appPaths = {
  explore: "/",
  showcase: "/showcase",
  create: "/create",
  library: "/library",
  feedback: "/feedback",
  studio: "/studio",
  models: "/admin/models",
  admin: "/admin",
  specAdmin: "/admin/materials",
} as const;

export type AppPath = (typeof appPaths)[keyof typeof appPaths];

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
