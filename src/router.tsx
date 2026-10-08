import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    // Route data and chunks usually settle in under a second. A pending page
    // shown immediately stays for the 500ms pendingMinMs, so it flashes.
    defaultPendingMs: 1000,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
