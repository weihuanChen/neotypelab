import { SignInButton, UserButton, useUser } from "@clerk/tanstack-react-start";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type ReactNode, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { appNavGroups, isNavItemActive } from "@/src/components/app-shell/nav";
import { useStartProviderStatus } from "@/src/providers/StartProviders";

type AppShellProps = {
  children: ReactNode;
  description?: string;
  title: string;
};

type AppViewer = FunctionReturnType<typeof api.users.viewer> | undefined;

export function AppShell({ children, description, title }: AppShellProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const providerStatus = useStartProviderStatus();

  if (!providerStatus.hasClerkProvider || !providerStatus.hasConvexClient) {
    return (
      <AppShellBody
        description={description}
        pathname={pathname}
        title={title}
        viewer={undefined}
      >
        {children}
      </AppShellBody>
    );
  }

  return (
    <LiveAppShell description={description} pathname={pathname} title={title}>
      {children}
    </LiveAppShell>
  );
}

function LiveAppShell({
  children,
  description,
  pathname,
  title,
}: AppShellProps & { pathname: string }) {
  const viewer = useQuery(api.users.viewer);

  return (
    <AppShellBody
      description={description}
      pathname={pathname}
      title={title}
      viewer={viewer}
    >
      {children}
    </AppShellBody>
  );
}

function AppShellBody({
  children,
  description,
  pathname,
  title,
  viewer,
}: AppShellProps & {
  pathname: string;
  viewer: AppViewer;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const groups = useMemo(
    () =>
      appNavGroups.filter(
        (group) => !group.adminOnly || Boolean(viewer?.canManagePlatform)
      ),
    [viewer?.canManagePlatform]
  );

  return (
    <div className="app-shell">
      {navOpen ? (
        <button
          aria-label="Close navigation"
          className="app-nav__backdrop"
          onClick={() => setNavOpen(false)}
          type="button"
        />
      ) : null}
      <aside className={navOpen ? "app-nav is-open" : "app-nav"}>
        <Link className="app-nav__brand" onClick={() => setNavOpen(false)} to="/">
          <span>Vol. 02</span>
          <strong>NeotypeLab</strong>
          <em>spray-ready almanac</em>
        </Link>
        <nav aria-label="Primary" className="app-nav__groups">
          {groups.map((group) => (
            <section className="app-nav__group" key={group.id}>
              <p>{group.label}</p>
              <div>
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={
                        active ? "app-nav__link is-active" : "app-nav__link"
                      }
                      key={item.href}
                      onClick={() => setNavOpen(false)}
                      preload="intent"
                      to={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="app-nav__viewer">
          <span>Operator</span>
          <strong>{viewer?.fullName ?? "Guest"}</strong>
        </div>
      </aside>
      <div className="app-shell__main">
        <header className="app-topbar">
          <div className="app-topbar__lead">
            <button
              aria-expanded={navOpen}
              aria-label="Open navigation"
              className="app-nav__toggle"
              onClick={() => setNavOpen((open) => !open)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className="app-topbar__kicker">NeotypeLab</p>
              <h1>{title}</h1>
              {description ? (
                <p className="app-topbar__copy">{description}</p>
              ) : null}
            </div>
          </div>
          <AppAuthSlot viewer={viewer} />
        </header>
        <div className="app-shell__content">{children}</div>
      </div>
    </div>
  );
}

function AppAuthSlot({ viewer }: { viewer: AppViewer }) {
  const providerStatus = useStartProviderStatus();

  if (!providerStatus.hasClerkProvider) {
    return <span className="app-topbar__auth-missing">Auth config</span>;
  }

  return <SignedInAuthSlot viewer={viewer} />;
}

function SignedInAuthSlot({ viewer }: { viewer: AppViewer }) {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <div className="app-topbar__auth">
      <div className="app-topbar__credits">
        <span>Credits</span>
        <strong>{viewer?.credits.balance ?? 0}</strong>
      </div>
      {isLoaded && isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="modal">
          <button className="showcase-button" type="button">
            Sign in
          </button>
        </SignInButton>
      )}
    </div>
  );
}
