export type AdminNavItem = {
  href: string;
  label: string;
};

export type AdminNavGroup = {
  id: "content" | "generation" | "operations" | "system";
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/admin/models", label: "Models" },
      { href: "/admin/styles", label: "Style DNA" },
      { href: "/admin/materials", label: "Materials" },
      { href: "/admin/paints", label: "Paints" },
      { href: "/admin/creator-packs", label: "Creator Packs" },
    ],
  },
  {
    id: "generation",
    label: "Generation",
    items: [
      { href: "/admin/templates", label: "Templates" },
      { href: "/admin/prompt-lab", label: "Prompt Lab" },
      { href: "/admin/generations", label: "Generation Logs" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/feedback", label: "Feedback" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/credits", label: "Credits" },
      { href: "/admin/orders", label: "Orders" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/audit-log", label: "Audit Log" },
    ],
  },
];
