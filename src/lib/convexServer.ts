import { ConvexHttpClient } from "convex/browser";

export function getConvexDeploymentUrl() {
  return (
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.VITE_CONVEX_URL ??
    process.env.CONVEX_URL ??
    null
  );
}

export function createConvexHttpClient() {
  const url = getConvexDeploymentUrl();

  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}
