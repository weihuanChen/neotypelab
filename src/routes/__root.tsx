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
import appCss from "@/src/styles/app.css?url";
import globalsCss from "@/src/styles/globals.css?url";

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
          "NeotypeLab public showcase and authenticated repaint creation terminal.",
      },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
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
          <div className="spike-shell">{children}</div>
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
