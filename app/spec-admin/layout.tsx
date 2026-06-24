import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { ReactNode } from "react";

export default function SpecAdminLayout({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-main px-4 py-10 text-ink-primary">
        <div className="mx-auto max-w-6xl border border-line-secondary bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">
            Spec Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Clerk publishable key is not configured.
          </h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    );
  }

  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
