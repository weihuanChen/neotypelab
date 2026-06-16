import { UserButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

const terminalNavItems = [
  { href: "/t", label: "Overview" },
  { href: "/t/create", label: "Create" },
  { href: "/t/library", label: "Library" },
  { href: "/t/showcase", label: "Showcase" },
  { href: "/t/feedback", label: "Feedback" },
] as const satisfies readonly TerminalNavItem[];

const adminNavItem = { href: "/t/admin", label: "Admin" } as const satisfies TerminalNavItem;

type TerminalNavHref =
  | "/t"
  | "/t/admin"
  | "/t/create"
  | "/t/feedback"
  | "/t/library"
  | "/t/showcase";

type TerminalNavItem = {
  href: TerminalNavHref;
  label: string;
};

type TerminalShellProps = {
  activePath: TerminalNavHref;
  children: ReactNode;
  description?: string;
  title: string;
};

type TerminalViewer = FunctionReturnType<typeof api.users.viewer> | undefined;

export function TerminalShell({
  activePath,
  children,
  description,
  title,
}: TerminalShellProps) {
  const providerStatus = useStartProviderStatus();

  if (!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient) {
    return (
      <TerminalShellBody
        activePath={activePath}
        description={description}
        providerStatus={providerStatus}
        title={title}
        viewer={undefined}
      >
        {children}
      </TerminalShellBody>
    );
  }

  return (
    <LiveTerminalShell
      activePath={activePath}
      description={description}
      providerStatus={providerStatus}
      title={title}
    >
      {children}
    </LiveTerminalShell>
  );
}

function LiveTerminalShell({
  activePath,
  children,
  description,
  providerStatus,
  title,
}: TerminalShellProps & {
  providerStatus: ReturnType<typeof useStartProviderStatus>;
}) {
  const viewer = useQuery(api.users.viewer);

  return (
    <TerminalShellBody
      activePath={activePath}
      description={description}
      providerStatus={providerStatus}
      title={title}
      viewer={viewer}
    >
      {children}
    </TerminalShellBody>
  );
}

function TerminalShellBody({
  activePath,
  children,
  description,
  providerStatus,
  title,
  viewer,
}: TerminalShellProps & {
  providerStatus: ReturnType<typeof useStartProviderStatus>;
  viewer: TerminalViewer;
}) {
  const visibleNavItems = viewer?.canManagePlatform
    ? [...terminalNavItems, adminNavItem]
    : terminalNavItems;

  return (
    <main className="terminal-shell">
      <section className="terminal-shell__header">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="terminal-shell__auth">
          <div className="terminal-shell__credits">
            <span>Credits</span>
            <strong>{viewer?.credits.balance ?? 0}</strong>
          </div>
          {providerStatus.hasClerkProvider ? (
            <UserButton />
          ) : (
            <span className="terminal-shell__auth-missing">Auth config</span>
          )}
        </div>
      </section>

      <section className="terminal-shell__nav-panel">
        <nav className="terminal-shell__nav" aria-label="Terminal routes">
          {visibleNavItems.map((item) => (
            <Link
              activeOptions={{ exact: true }}
              aria-current={activePath === item.href ? "page" : undefined}
              className={
                activePath === item.href
                  ? "showcase-chip is-active"
                  : "showcase-chip is-button"
              }
              key={item.href}
              preload="render"
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="terminal-shell__operator">
          <span>Operator</span>
          <strong>{viewer?.fullName ?? "Syncing pilot"}</strong>
          <em>{viewer?.email ?? "Waiting for auth"}</em>
        </div>
      </section>

      {!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient ? (
        <section className="terminal-shell__provider">
          <span>
            Clerk {providerStatus.hasClerkProvider ? "ready" : "missing"}
          </span>
          <span>
            Convex {providerStatus.hasConvexClient ? "ready" : "missing"}
          </span>
          <span>
            Auth bridge {providerStatus.hasConvexAuthBridge ? "ready" : "blocked"}
          </span>
        </section>
      ) : null}

      <div className="terminal-shell__body">{children}</div>
    </main>
  );
}
