"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { href: "/t", label: "Overview" },
  { href: "/t/create", label: "Create" },
  { href: "/t/library", label: "Library" },
  { href: "/t/showcase", label: "Showcase" },
  { href: "/t/feedback", label: "Feedback" },
];

export function TerminalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const viewer = useQuery(api.users.viewer);
  const visibleNavItems = viewer?.canManagePlatform
    ? [...navItems, { href: "/t/admin", label: "Admin" }]
    : navItems;

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]">
      <header className="border-b border-white/10 bg-[#11161D]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">
              NeotypeLab Terminal
            </p>
            <h1 className="text-lg font-semibold">Prototype Control Surface</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#9BA7B4] md:block">
              Credits / Reactor Capacity: {viewer?.credits.balance ?? 0}
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-[#161B22] p-3">
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-xl border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-[#3DD9FF]/40 bg-[#3DD9FF]/10 text-[#E6EDF3]"
                      : "border-transparent text-[#9BA7B4] hover:border-white/10 hover:bg-white/5 hover:text-[#E6EDF3]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-[#9BA7B4]">
            <p className="text-xs uppercase tracking-[0.24em] text-[#58FFB2]">
              Operator
            </p>
            <p className="mt-2 font-medium text-[#E6EDF3]">
              {viewer?.fullName ?? "Syncing pilot profile"}
            </p>
            <p className="mt-1 text-xs">{viewer?.email ?? "Waiting for auth"}</p>
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
