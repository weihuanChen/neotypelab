import { UserButton } from "@clerk/tanstack-react-start";
import {
  Cross1Icon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  HamburgerMenuIcon,
} from "@radix-ui/react-icons";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAppShellState } from "@/src/components/app-shell/AppShellState";
import { adminNavGroups } from "./adminNavigation";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const viewer = useQuery(api.users.viewer);
  const { sidebarCollapsed, sidebarStateReady, toggleSidebar } = useAppShellState();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => setMobileNavOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const visible = isMobile ? mobileNavOpen : !sidebarCollapsed;
  const toggleLabel = isMobile
    ? mobileNavOpen ? "Close admin navigation" : "Open admin navigation"
    : sidebarCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar";

  const toggle = () => {
    if (isMobile) setMobileNavOpen((open) => !open);
    else toggleSidebar();
  };

  if (viewer == null) {
    return <main className="admin-gate"><p>NeotypeLab Admin</p><h1>Resolving platform clearance.</h1></main>;
  }

  if (!viewer.canManagePlatform) {
    return <main className="admin-gate"><p>Admin only</p><h1>Platform administrator access is required.</h1><Link to="/">Back to NeotypeLab</Link></main>;
  }

  return (
    <div className={cn("app-shell admin-shell", sidebarCollapsed && "is-nav-collapsed", sidebarStateReady && "is-nav-ready")}>
      {mobileNavOpen ? (
        <button
          aria-label="Close admin navigation"
          className="app-nav__backdrop"
          onClick={() => {
            setMobileNavOpen(false);
            window.requestAnimationFrame(() => toggleRef.current?.focus());
          }}
          type="button"
        />
      ) : null}
      <aside aria-hidden={!visible} className={cn("app-nav admin-nav", mobileNavOpen && "is-open")} id="admin-primary-navigation" ref={navRef}>
        <Link className="app-nav__brand admin-nav__brand" tabIndex={visible ? undefined : -1} to="/admin">
          <span>NeotypeLab</span>
          <strong>Admin</strong>
          <em>operations console</em>
        </Link>
        <Link className="admin-nav__back" tabIndex={visible ? undefined : -1} to="/">
          ← Back to NeotypeLab
        </Link>
        <nav aria-label="Admin workspaces" className="app-nav__groups">
          {adminNavGroups.map((group) => (
            <section className="app-nav__group" key={group.id}>
              <p>{group.label}</p>
              <div>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn("app-nav__link", active && "is-active")}
                      key={item.href}
                      tabIndex={visible ? undefined : -1}
                      to={item.href as never}
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
          <strong>{viewer?.fullName ?? "Syncing"}</strong>
        </div>
      </aside>
      <div className="app-shell__main">
        <header className="app-topbar admin-topbar">
          <div className="app-topbar__lead">
            <button aria-controls="admin-primary-navigation" aria-expanded={visible} aria-label={toggleLabel} className="app-nav__toggle" onClick={toggle} ref={toggleRef} type="button">
              {isMobile ? mobileNavOpen ? <Cross1Icon /> : <HamburgerMenuIcon /> : sidebarCollapsed ? <DoubleArrowRightIcon /> : <DoubleArrowLeftIcon />}
            </button>
            <div>
              <p className="app-topbar__kicker">NeotypeLab</p>
              <h1>Admin Console</h1>
              <p className="app-topbar__copy">Platform operations and system configuration.</p>
            </div>
          </div>
          <div className="app-topbar__auth">
            <div className="app-topbar__credits"><span>Credits</span><strong>{viewer?.credits.balance ?? 0}</strong></div>
            <UserButton />
          </div>
        </header>
        <main className="app-shell__content admin-shell__content">{children}</main>
      </div>
    </div>
  );
}
