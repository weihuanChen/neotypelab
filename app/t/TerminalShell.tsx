"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { PsychoFrameBorder } from "@/components/ui/PsychoFrameBorder";

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
    ? [
        ...navItems,
        { href: "/t/models", label: "Models" },
        { href: "/t/admin", label: "Admin" },
        { href: "/spec-admin/materials", label: "Spec Admin" },
      ]
    : navItems;

  return (
    <div className="min-h-screen bg-main bg-grid-blueprint text-ink-primary relative">
      {/* Decorative Blueprint Framing (HUD) */}
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-4 xl:p-6 text-[10px] font-mono uppercase leading-tight tracking-[0.2em] text-ink-muted opacity-80">
        <div className="flex justify-between items-start pt-16">
          <div className="ml-2">
            <p className="font-bold text-ink-primary">NTL-MANUAL</p>
            <p>SECTION 02</p>
          </div>
          <div className="mr-2 text-right">
            <p className="font-bold text-ink-primary">DOC-REF:</p>
            <p>V2-LTR</p>
          </div>
        </div>
        
        <div className="flex justify-between items-end mb-2">
          <div className="text-left hidden sm:block ml-2">
            <p className="font-bold text-ink-primary">SYS.STATUS</p>
            <p>NOMINAL</p>
          </div>
          <div className="text-center absolute bottom-4 xl:bottom-6 left-1/2 -translate-x-1/2">
            <p className="font-bold text-ink-primary">PAGE</p>
            <p>02 / 12</p>
          </div>
          <div className="text-right mr-2">
            <p className="font-bold text-ink-primary">REVISION</p>
            <p>0.3</p>
          </div>
        </div>
      </div>

      <header className="relative z-40 border-b border-line-secondary bg-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">
              NeotypeLab Terminal
            </p>
            <h1 className="text-lg font-semibold">Prototype Control Surface</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden border border-line-secondary bg-black/5 px-3 py-1 text-sm text-ink-secondary md:block">
              Credits / Reactor Capacity: {viewer?.credits.balance ?? 0}
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* NEW Sub-header Navigation */}
      <div className="border-b border-line-secondary bg-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <nav className="flex -mb-px overflow-x-auto hide-scrollbar">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center border-b-2 px-5 py-3 text-sm font-bold tracking-widest uppercase transition-colors whitespace-nowrap",
                    active
                      ? "border-accent-blue bg-surface text-ink-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                      : "border-transparent text-ink-secondary hover:border-line-guide hover:bg-hover-subtle hover:text-ink-primary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          {/* Dense Operator Readout (replaces old aside card) */}
          <div className="hidden items-center gap-4 text-xs lg:flex px-4 py-3 border-l border-line-secondary bg-black/5 relative overflow-hidden">
            <PsychoFrameBorder color="#58FFB2" particleCount={25} />
            <span className="uppercase tracking-[0.24em] text-accent-teal font-bold relative z-10">Operator</span>
            <div className="flex items-center gap-2 border-l border-line-secondary pl-4 relative z-10">
              <span className="font-bold text-ink-primary tracking-wider uppercase">{viewer?.fullName ?? "SYNCING PILOT"}</span>
              <span className="opacity-60 font-mono tracking-tighter">{viewer?.email ?? "WAITING FOR AUTH"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Main Content (full max-w-7xl width) */}
      <div className="mx-auto max-w-7xl px-4 py-6 w-full">
        <main>{children}</main>
      </div>
    </div>
  );
}
