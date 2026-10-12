import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { getResponseStatus } from "@tanstack/react-start/server";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Apply to the final response, including TanStack's not-found boundary. Route
// headers and server-function headers are not preserved by every error path.
const showcaseCacheMiddleware = createMiddleware({ type: "request" }).server(async ({ pathname, next }) => {
  const result = await next();
  if (pathname === "/" || pathname === "/showcase" || pathname === "/sitemap.xml" ||
    ["/prototype/", "/showcase/", "/pilot/", "/creator/", "/creator-pack/"].some(prefix => pathname.startsWith(prefix))) {
    const headers = new Headers(result.response.headers);
    headers.set("Cache-Control", "no-store");
    if (result.response.status === 404) headers.set("X-Robots-Tag", "noindex");
    const requestedStatus = getResponseStatus();
    const status = result.response.status === 200 && requestedStatus >= 500 ? requestedStatus : result.response.status;
    if (status === 503 && !headers.has("Retry-After")) headers.set("Retry-After", "60");
    result.response = new Response(result.response.body, {
      status,
      headers,
    });
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    showcaseCacheMiddleware,
    ...(clerkPublishableKey && process.env.CLERK_SECRET_KEY
      ? [
          clerkMiddleware({
            publishableKey: clerkPublishableKey,
            secretKey: process.env.CLERK_SECRET_KEY,
          }),
        ]
      : []),
  ],
}));
