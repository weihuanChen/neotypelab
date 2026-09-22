import { appPaths, publicStylesEnabled, type AppPath } from "@/src/lib/appPaths";

export type AppNavGroupId =
  | "discover"
  | "create"
  | "account"
  | "information"
  | "admin";

export type AppNavItem = {
  href: AppPath;
  label: string;
  match: "exact" | "prefix";
  /** Optional nested label inside a group (e.g. Legal → Terms / Privacy). */
  nestUnder?: string;
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
      ...(publicStylesEnabled
        ? [{ href: appPaths.styles, label: "Styles", match: "prefix" as const }]
        : []),
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
    id: "information",
    label: "Information",
    items: [
      { href: appPaths.pricing, label: "Pricing", match: "exact" },
      { href: appPaths.contact, label: "Contact", match: "exact" },
      // Hub page "Information" is intentionally closed for now.
      {
        href: appPaths.legal,
        label: "Terms & Privacy",
        match: "prefix",
      },
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

const seoLandingReservedRoots = [
  "c",
  "community",
  "styles",
  "t",
  "showcase",
  "create",
  "library",
  "feedback",
  "studio",
  "pricing",
  "contact",
  "legal",
  "terms",
  "privacy",
  "prototype",
  "pilot",
  "creator",
  "creator-pack",
  "spec-admin",
  "admin",
] as const;

export function isNavItemActive(pathname: string, item: AppNavItem) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  if (item.href === appPaths.communityStyles && pathname.startsWith("/c/")) return true;

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
    !seoLandingReservedRoots.includes(
      segments[0] as (typeof seoLandingReservedRoots)[number]
    )
  );
}
