import { SignInButton, UserButton, useUser } from "@clerk/tanstack-react-start";
import {
  Cross1Icon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  HamburgerMenuIcon,
} from "@radix-ui/react-icons";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import { useAppShellState } from "@/src/components/app-shell/AppShellState";
import { appNavGroups, isNavItemActive } from "@/src/components/app-shell/nav";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import { cn } from "@/lib/utils";

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
  const { sidebarCollapsed, sidebarStateReady, toggleSidebar } =
    useAppShellState();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const groups = useMemo(
    () =>
      appNavGroups.filter(
        (group) => !group.adminOnly || Boolean(viewer?.canManagePlatform)
      ),
    [viewer?.canManagePlatform]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileNavOpen) {
        setMobileNavOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        if (isMobile) {
          setMobileNavOpen((open) => !open);
        } else {
          if (!sidebarCollapsed && navRef.current?.contains(document.activeElement)) {
            toggleRef.current?.focus();
          }
          toggleSidebar();
        }
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [isMobile, mobileNavOpen, sidebarCollapsed, toggleSidebar]);

  const navigationVisible = isMobile ? mobileNavOpen : !sidebarCollapsed;
  const toggleLabel = isMobile
    ? mobileNavOpen
      ? "Close navigation"
      : "Open navigation"
    : sidebarCollapsed
      ? "Expand sidebar"
      : "Collapse sidebar";

  const handleToggle = () => {
    if (isMobile) {
      setMobileNavOpen((open) => !open);
      return;
    }
    if (!sidebarCollapsed && navRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
    toggleSidebar();
  };

  return (
    <div
      className={cn(
        "app-shell",
        sidebarCollapsed && "is-nav-collapsed",
        sidebarStateReady && "is-nav-ready"
      )}
    >
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="app-nav__backdrop"
          onClick={() => {
            setMobileNavOpen(false);
            window.requestAnimationFrame(() => toggleRef.current?.focus());
          }}
          type="button"
        />
      ) : null}
      <aside
        aria-hidden={!navigationVisible}
        className={mobileNavOpen ? "app-nav is-open" : "app-nav"}
        id="app-primary-navigation"
        ref={navRef}
      >
        <Link
          className="app-nav__brand"
          onClick={() => setMobileNavOpen(false)}
          tabIndex={navigationVisible ? undefined : -1}
          to="/"
        >
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
                      onClick={() => setMobileNavOpen(false)}
                      preload="intent"
                      tabIndex={navigationVisible ? undefined : -1}
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
              aria-controls="app-primary-navigation"
              aria-expanded={navigationVisible}
              aria-label={toggleLabel}
              className="app-nav__toggle"
              onClick={handleToggle}
              ref={toggleRef}
              title={`${toggleLabel} (⌘\\)`}
              type="button"
            >
              {isMobile ? (
                mobileNavOpen ? <Cross1Icon /> : <HamburgerMenuIcon />
              ) : sidebarCollapsed ? (
                <DoubleArrowRightIcon />
              ) : (
                <DoubleArrowLeftIcon />
              )}
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
