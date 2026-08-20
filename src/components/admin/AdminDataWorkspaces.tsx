import { useQuery } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export function GenerationLogsWorkspace({ initialRunId }: { initialRunId?: string }) {
  const navigate = useNavigate();
  const jobs = useQuery(api.admin.listGenerationJobsAdmin);
  const [selectedId, setSelectedId] = useState<string | null>(initialRunId ?? null);
  useEffect(() => {
    if (!selectedId && jobs?.[0]) setSelectedId(jobs[0]._id);
  }, [jobs, selectedId]);
  useEffect(() => {
    if (initialRunId) setSelectedId(initialRunId);
  }, [initialRunId]);
  const selected = jobs?.find((item) => item._id === selectedId) ?? null;

  return (
    <div className="admin-data-page">
      <WorkspaceTitle eyebrow="Generation" title="Generation Logs" description="Inspect pipeline jobs, inputs, outputs, and failures without changing their history." />
      <div className="admin-table-inspector">
        <section className="admin-data-table" aria-label="Generation jobs">
          <div className="admin-table-head admin-generation-row"><span>Status</span><span>Type</span><span>Kit</span><span>User</span><span>Time</span></div>
          {jobs === undefined ? <DataEmpty label="Loading generation jobs." /> : jobs.length === 0 ? <DataEmpty label="No generation jobs yet." /> : jobs.map((job) => (
            <button className={cn("admin-table-row admin-generation-row", selectedId === job._id && "is-active")} key={job._id} onClick={() => { setSelectedId(job._id); void navigate({ to: "/admin/generations", search: { run: job._id }, replace: true }); }} type="button">
              <StatusText status={job.status} /><span>{formatKind(job.kind)}</span><span>{job.model?.name ?? "—"}</span><span>{job.user?.handle ? `@${job.user.handle}` : job.user?.fullName ?? "—"}</span><time>{formatTime(job._creationTime)}</time>
            </button>
          ))}
        </section>
        <aside className="admin-record-inspector">
          {selected ? <><InspectorHead title={`Generation ${shortId(selected._id)}`} meta={`${formatKind(selected.kind)} · ${selected.status}`} /><InspectorRows rows={[
            ["Status", selected.status], ["Provider", selected.provider ?? "Not assigned"], ["Kit", selected.model?.name ?? "—"], ["Style", selected.style?.name ?? "—"], ["Material", selected.material?.name ?? "—"], ["Credits", String(selected.requestedCredits)], ["User", selected.user?.email ?? "—"], ["Created", formatDateTime(selected._creationTime)]
          ]} />{selected.errorMessage ? <InspectorBlock title="Error"><pre>{selected.errorMessage}</pre></InspectorBlock> : null}{selected.inputSnapshotJson ? <InspectorBlock title="Input snapshot"><pre>{prettyJson(selected.inputSnapshotJson)}</pre></InspectorBlock> : null}{selected.outputSummaryJson ? <InspectorBlock title="Provider response"><pre>{prettyJson(selected.outputSummaryJson)}</pre></InspectorBlock> : null}</> : <DataEmpty label="Select a generation job." />}
        </aside>
      </div>
    </div>
  );
}

export function OrdersWorkspace() {
  const orders = useQuery(api.admin.listOrdersAdmin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { if (!selectedId && orders?.[0]) setSelectedId(orders[0]._id); }, [orders, selectedId]);
  const selected = orders?.find((item) => item._id === selectedId) ?? null;
  return (
    <div className="admin-data-page">
      <WorkspaceTitle eyebrow="Operations" title="Orders" description="Review payment records and the products attached to each order." />
      <div className="admin-table-inspector">
        <section className="admin-data-table" aria-label="Orders">
          <div className="admin-table-head admin-order-row"><span>Order</span><span>User</span><span>Status</span><span>Total</span><span>Time</span></div>
          {orders === undefined ? <DataEmpty label="Loading orders." /> : orders.length === 0 ? <DataEmpty label="No orders yet." /> : orders.map((order) => (
            <button className={cn("admin-table-row admin-order-row", selectedId === order._id && "is-active")} key={order._id} onClick={() => setSelectedId(order._id)} type="button">
              <span className="is-mono">{order.orderNumber}</span><span>{order.user?.handle ? `@${order.user.handle}` : order.user?.fullName ?? "—"}</span><StatusText status={order.status} /><span>{formatMoney(order.totalMinor, order.currency)}</span><time>{formatTime(order._creationTime)}</time>
            </button>
          ))}
        </section>
        <aside className="admin-record-inspector">{selected ? <><InspectorHead title={selected.orderNumber} meta={`${selected.status} · ${selected.currency.toUpperCase()}`} /><InspectorRows rows={[["Customer", selected.user?.email ?? "—"], ["Subtotal", formatMoney(selected.subtotalMinor, selected.currency)], ["Total", formatMoney(selected.totalMinor, selected.currency)], ["Provider", selected.paymentProvider ?? "—"], ["External ID", selected.externalPaymentId ?? "—"], ["Updated", formatDateTime(selected.updatedAt)]]} /><InspectorBlock title={`Items · ${selected.items.length}`}>{selected.items.length ? selected.items.map((item) => <div className="admin-inspector-item" key={item._id}><span>{item.title}</span><strong>{item.quantity} × {formatMoney(item.unitAmountMinor, selected.currency)}</strong></div>) : <p>No order items.</p>}</InspectorBlock></> : <DataEmpty label="Select an order." />}</aside>
      </div>
    </div>
  );
}

export function AuditLogWorkspace() {
  const logs = useQuery(api.admin.listAuditLog);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { if (!selectedId && logs?.[0]) setSelectedId(logs[0]._id); }, [logs, selectedId]);
  const selected = logs?.find((item) => item._id === selectedId) ?? null;
  return (
    <div className="admin-data-page">
      <WorkspaceTitle eyebrow="System" title="Audit Log" description="Immutable operator activity across platform-admin mutations." />
      <div className="admin-table-inspector">
        <section className="admin-data-table" aria-label="Audit log">
          <div className="admin-table-head admin-audit-row"><span>Action</span><span>Entity</span><span>Operator</span><span>Time</span></div>
          {logs === undefined ? <DataEmpty label="Loading audit history." /> : logs.length === 0 ? <DataEmpty label="No audit events yet." /> : logs.map((log) => (
            <button className={cn("admin-table-row admin-audit-row", selectedId === log._id && "is-active")} key={log._id} onClick={() => setSelectedId(log._id)} type="button"><span className="is-mono">{log.action}</span><span>{log.entityType}</span><span>{log.actor?.fullName ?? log.actor?.email ?? "Unknown"}</span><time>{formatTime(log._creationTime)}</time></button>
          ))}
        </section>
        <aside className="admin-record-inspector">{selected ? <><InspectorHead title={selected.action} meta={`${selected.entityType} · ${formatDateTime(selected._creationTime)}`} /><InspectorRows rows={[["Operator", selected.actor?.email ?? "Unknown"], ["Entity type", selected.entityType], ["Entity ID", selected.entityId ?? "—"]]} />{selected.detailsJson ? <InspectorBlock title="Details"><pre>{prettyJson(selected.detailsJson)}</pre></InspectorBlock> : null}</> : <DataEmpty label="Select an audit event." />}</aside>
      </div>
    </div>
  );
}

export function SettingsWorkspace() {
  const routing = useQuery(api.admin.listLlmRoutingConfig);
  return (
    <div className="admin-data-page">
      <WorkspaceTitle eyebrow="System" title="Settings" description="Generation providers, model routing, and prompt-template bindings." />
      {routing === undefined ? <DataEmpty label="Loading platform settings." /> : <div className="admin-settings-grid"><section><h3>LLM Profiles</h3>{routing.profiles.map((profile) => <article className="admin-settings-record" key={profile._id}><div><strong>{profile.name}</strong><span>{profile.provider} · {profile.modelId}</span></div><StatusText status={profile.isActive ? "active" : "inactive"} /></article>)}</section><section><h3>Template Bindings</h3>{routing.bindings.map((binding) => <article className="admin-settings-record" key={binding._id}><div><strong>{binding.template?.name ?? binding.templateKind}</strong><span>{binding.profile?.name ?? "Missing profile"} · priority {binding.priority}</span></div><StatusText status={binding.isActive ? "active" : "inactive"} /></article>)}</section></div>}
    </div>
  );
}

function WorkspaceTitle({ description, eyebrow, title }: { description: string; eyebrow: string; title: string }) { return <header className="admin-workspace-head"><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></header>; }
function InspectorHead({ meta, title }: { meta: string; title: string }) { return <header className="admin-inspector-head"><h3>{title}</h3><p>{meta}</p></header>; }
function InspectorRows({ rows }: { rows: Array<[string, string]> }) { return <dl className="admin-inspector-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
function InspectorBlock({ children, title }: { children: ReactNode; title: string }) { return <section className="admin-inspector-block"><h4>{title}</h4>{children}</section>; }
function DataEmpty({ label }: { label: string }) { return <div className="admin-data-empty">{label}</div>; }
function StatusText({ status }: { status: string }) { const normalized = status.toLowerCase(); return <span className={cn("admin-status-text", ["active", "succeeded", "paid", "completed"].includes(normalized) && "is-success", ["failed", "canceled", "suspended"].includes(normalized) && "is-danger", ["queued", "running", "pending"].includes(normalized) && "is-warning")}>{status}</span>; }
function formatKind(value: string) { return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatTime(value: number) { return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(value); }
function formatDateTime(value: number) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value); }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(value / 100); }
function shortId(value: string) { return `#${value.slice(-6).toUpperCase()}`; }
function prettyJson(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
