import { createServerFn } from "@tanstack/react-start";
import { api } from "@/convex/_generated/api";
import type { HomeSnapshot } from "@/src/components/home/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

export const getHomeSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeSnapshot> => {
    const convex = createConvexHttpClient();
    if (!convex) {
      return { status: "missing-env", data: null, message: "NeotypeLab could not load this page just now." };
    }
    try {
      const [data, availability] = await Promise.all([
        convex.query(api.homeFeature.getHome, {}),
        convex.query(api.customKits.availability, {}).catch(() => null),
      ]);
      return { status: "ok", data, customKit: availability?.enabled === true };
    } catch (error) {
      return { status: "error", data: null, message: error instanceof Error ? error.message : String(error) };
    }
  },
);

/** Old Explore filter links (`/?style=…`) now belong to the Showcase archive. */
const legacyArchiveParams = ["sort", "view", "baseModel", "style", "material", "weathering", "category", "creator", "q"] as const;

export function legacyArchiveRedirect(search: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const key of legacyArchiveParams) {
    const value = search[key];
    if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  }
  const query = params.toString();
  return query ? `/showcase/archive?${query}` : null;
}
