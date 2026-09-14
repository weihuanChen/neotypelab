import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";

async function readPublic<T>(read: (client: NonNullable<ReturnType<typeof createConvexHttpClient>>) => Promise<T | null>) {
  const client = createConvexHttpClient();
  if (!client) return { status: "unavailable" as const, data: null };
  try {
    const data = await read(client);
    return { status: data === null ? "not-found" as const : "ok" as const, data };
  } catch {
    return { status: "unavailable" as const, data: null };
  }
}
export const getStyleGallery = createServerFn({ method: "GET" }).handler(() =>
  readPublic(client => client.query(api.styleEditorial.gallery, {})));
export const getStylePage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().max(160) }))
  .handler(({ data }) => readPublic(client => client.query(api.styleEditorial.getStyle, data)));
export const getStyleModelPage = createServerFn({ method: "GET" })
  .validator(z.object({ styleSlug: z.string().max(160), modelSlug: z.string().max(160) }))
  .handler(({ data }) => readPublic(client => client.query(api.styleEditorial.getPair, data)));

export const getCommunityGallery = createServerFn({ method: "GET" }).handler(() =>
  readPublic(client => client.query(api.userStyles.community, {})));
export const getCommunityStylePage = createServerFn({ method: "GET" })
  .validator(z.object({ styleId: z.string().max(160) }))
  .handler(({ data }) => readPublic(client => client.query(api.userStyles.getCommunityStyle, data)));
