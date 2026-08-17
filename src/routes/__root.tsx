/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { lazy, Suspense, type ReactNode } from "react";
import { DefaultCatchBoundary } from "@/src/components/DefaultCatchBoundary";
import { NotFound } from "@/src/components/NotFound";
import { StartProviders } from "@/src/providers/StartProviders";
import tokensCss from "@/src/styles/tokens.css?url";
import appCss from "@/src/styles/app.css?url";
import globalsCss from "@/src/styles/globals.css?url";
import workbenchCss from "@/src/styles/workbench.css?url";
import exploreCss from "@/src/styles/explore.css?url";
import exhibitionCss from "@/src/styles/showcase-exhibition.css?url";

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools,
      }))
    )
  : null;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "NeotypeLab",
      },
      {
        name: "description",
        content:
          "Explore public mecha repaint prototypes and start a structured create session.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap",
      },
      { rel: "stylesheet", href: tokensCss },
      { rel: "stylesheet", href: globalsCss },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: workbenchCss },
      { rel: "stylesheet", href: exploreCss },
      { rel: "stylesheet", href: exhibitionCss },
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
          <div className="app-root">{children}</div>
        </StartProviders>
        {RouterDevtools ? (
          <Suspense fallback={null}>
            <RouterDevtools position="bottom-right" />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
