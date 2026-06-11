import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

export const startInstance = createStart(() => ({
  requestMiddleware:
    clerkPublishableKey && process.env.CLERK_SECRET_KEY
      ? [
          clerkMiddleware({
            publishableKey: clerkPublishableKey,
            secretKey: process.env.CLERK_SECRET_KEY,
          }),
        ]
      : [],
}));
