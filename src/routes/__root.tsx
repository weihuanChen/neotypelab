/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { DefaultCatchBoundary } from "@/src/components/DefaultCatchBoundary";
import { NotFound } from "@/src/components/NotFound";
import { StartProviders } from "@/src/providers/StartProviders";
import legacyGlobalsCss from "@/app/globals.css?url";
import appCss from "@/src/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "NeotypeLab TanStack Spike",
      },
      {
        name: "description",
        content:
          "Cloudflare Workers rendering spike for NeotypeLab using TanStack Start and Convex.",
      },
    ],
    links: [
      { rel: "stylesheet", href: legacyGlobalsCss },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <StartProviders>
          <div className="spike-shell">
            <header className="spike-header">
              <Link className="spike-brand" to="/">
                <span>NeotypeLab</span>
                <strong>TanStack Spike</strong>
              </Link>
              <nav className="spike-nav" aria-label="Spike routes">
                <Link to="/" activeOptions={{ exact: true }}>
                  Home
                </Link>
                <Link to="/showcase">Showcase</Link>
                <Link to="/t" activeOptions={{ exact: true }}>
                  Terminal Auth
                </Link>
                <Link to="/t/create">Create</Link>
                <Link to="/t/library">Library</Link>
              </nav>
            </header>
            {children}
          </div>
        </StartProviders>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
