import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { TerminalShell } from "@/app/t/TerminalShell";
import { ReactNode } from "react";

export default function TerminalLayout({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-[#0D1117] px-4 py-10 text-[#E6EDF3]">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-[#161B22] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">
            Terminal Preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Clerk publishable key is not configured in this environment.
          </h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <ConvexClientProvider>
      <TerminalShell>{children}</TerminalShell>
    </ConvexClientProvider>
  );
}
