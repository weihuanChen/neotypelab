import { appPaths, type AppPath } from "@/src/lib/appPaths";

export type AppNavGroupId = "discover" | "create" | "account" | "admin";

export type AppNavItem = {
  href: AppPath;
  label: string;
  match: "exact" | "prefix";
};

export type AppNavGroup = {
  id: AppNavGroupId;
  label: string;
  items: readonly AppNavItem[];
  adminOnly?: boolean;
};

export const appNavGroups: readonly AppNavGroup[] = [
  {
    id: "discover",
    label: "Discover",
    items: [
      { href: appPaths.explore, label: "Explore", match: "exact" },
      { href: appPaths.showcase, label: "Showcase", match: "prefix" },
    ],
  },
  {
    id: "create",
    label: "Create",
    items: [
      { href: appPaths.create, label: "Create", match: "prefix" },
      { href: appPaths.library, label: "Library", match: "prefix" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: appPaths.feedback, label: "Feedback", match: "prefix" },
      { href: appPaths.studio, label: "Studio", match: "prefix" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    adminOnly: true,
    items: [
      { href: appPaths.admin, label: "Admin Console", match: "prefix" },
    ],
  },
];

const discoverPrefixes = [
  "/prototype",
  "/pilot",
  "/creator",
  "/creator-pack",
];

export function isNavItemActive(pathname: string, item: AppNavItem) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  if (item.href === appPaths.showcase) {
    return (
      pathname === appPaths.showcase ||
      pathname.startsWith(`${appPaths.showcase}/`) ||
      discoverPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      ) ||
      isSeoLandingPath(pathname)
    );
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isSeoLandingPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 2 &&
    !["t", "showcase", "create", "library", "feedback", "studio", "prototype", "pilot", "creator", "creator-pack", "spec-admin"].includes(
      segments[0]
    )
  );
}
