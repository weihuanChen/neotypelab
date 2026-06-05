import { DashboardOverview } from "@/app/t/DashboardOverview";

export default function TerminalOverviewPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line-secondary bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">
          Overview
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-ink-primary">
          NeotypeLab P1 foundation is now running on the product domain model.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          This shell is intentionally product-oriented: create flow, saved concepts,
          feedback intake, admin operations, and a future generation pipeline. The
          old team/members/invites starter topology has been removed from the app
          surface.
        </p>
      </section>
      {hasClerk ? (
        <DashboardOverview />
      ) : (
        <section className="rounded-3xl border border-line-secondary bg-panel p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">
            Preview Mode
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
            Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and the matching Clerk server
            variables to activate authenticated dashboard data, Convex-backed viewer
            bootstrap, and live credit/state queries.
          </p>
        </section>
      )}
    </div>
  );
}
