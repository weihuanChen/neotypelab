import { ConvexHttpClient } from "convex/browser";

export function getConvexDeploymentUrl() {
  return import.meta.env.VITE_CONVEX_URL || null;
}

export function createConvexHttpClient() {
  const url = getConvexDeploymentUrl();

  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}
