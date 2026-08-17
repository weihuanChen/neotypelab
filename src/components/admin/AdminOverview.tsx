import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { adminNavGroups } from "./adminNavigation";

export function AdminOverview() {
  const overview = useQuery(api.admin.overview);

  if (overview === undefined) {
    return <AdminOverviewLoading />;
  }

  const attention = [
    overview.openFeedbackCount > 0 ? { href: "/admin/feedback", label: `${overview.openFeedbackCount} feedback reports require review` } : null,
    overview.failedGenerationCount > 0 ? { href: "/admin/generations", label: `${overview.failedGenerationCount} generation jobs require attention` } : null,
    overview.queuedGenerationCount > 0 ? { href: "/admin/generations", label: `${overview.queuedGenerationCount} generation jobs are queued` } : null,
  ].filter((item): item is { href: string; label: string } => item !== null);

  const counts: Record<string, string> = {
    "/admin/models": `${overview.baseModelCount} kits`,
    "/admin/styles": `${overview.stylePresetCount} presets`,
    "/admin/materials": `${overview.materialPresetCount} profiles`,
    "/admin/templates": `${overview.activePromptTemplateCount} active`,
    "/admin/generations": `${overview.generationJobCount ?? 0} jobs`,
    "/admin/feedback": `${overview.openFeedbackCount} open`,
    "/admin/users": `${overview.userCount}`,
    "/admin/credits": `${overview.totalCreditBalance} issued`,
    "/admin/orders": `${overview.orderCount ?? 0}`,
    "/admin/audit-log": `${overview.auditLogCount ?? 0}`,
    "/admin/paints": `${overview.paintMappingCount ?? 0} paints`,
    "/admin/creator-packs": `${overview.creatorPackCount ?? 0} packs`,
  };

  return (
    <div className="admin-overview">
      <header className="admin-workspace-head">
        <p>Admin</p>
        <h2>System operations and configuration.</h2>
      </header>

      <section className="admin-attention" aria-labelledby="admin-attention-title">
        <div className="admin-section-label"><h3 id="admin-attention-title">Attention</h3><span>{attention.length}</span></div>
        {attention.length ? attention.map((item) => (
          <Link className="admin-attention__row" key={item.href + item.label} to={item.href as never}>
            <span>{item.label}</span><span aria-hidden="true">→</span>
          </Link>
        )) : <p className="admin-empty-row">No items require attention.</p>}
      </section>

      <section className="admin-system-status" aria-labelledby="admin-status-title">
        <div className="admin-section-label"><h3 id="admin-status-title">System status</h3></div>
        <div className="admin-status-grid">
          <StatusRow label="Generation pipeline" value={overview.failedGenerationCount ? "Attention required" : "Operational"} tone={overview.failedGenerationCount ? "warning" : "healthy"} />
          <StatusRow label="Open generation faults" value={String(overview.failedGenerationCount)} tone={overview.failedGenerationCount ? "warning" : "healthy"} />
          <StatusRow label="Queued jobs" value={String(overview.queuedGenerationCount)} tone="neutral" />
          <StatusRow label="Active templates" value={String(overview.activePromptTemplateCount)} tone="neutral" />
        </div>
      </section>

      <section aria-labelledby="admin-workspaces-title">
        <div className="admin-section-label"><h3 id="admin-workspaces-title">Workspaces</h3></div>
        <div className="admin-workspace-groups">
          {adminNavGroups.map((group) => (
            <section className="admin-workspace-group" key={group.id}>
              <h4>{group.label}</h4>
              {group.items.map((item) => (
                <Link className="admin-workspace-link" key={item.href} to={item.href as never}>
                  <span>{item.label}</span><small>{counts[item.href] ?? "→"}</small>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusRow({ label, tone, value }: { label: string; tone: "healthy" | "neutral" | "warning"; value: string }) {
  return <div className="admin-status-row"><span>{label}</span><strong className={`is-${tone}`}>{value}</strong></div>;
}

function AdminOverviewLoading() {
  return <section className="admin-workspace-head"><p>Admin</p><h2>Loading system status.</h2></section>;
}
