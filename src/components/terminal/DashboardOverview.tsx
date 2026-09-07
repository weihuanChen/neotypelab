"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";

type StudioSection = "overview" | "spray-plans" | "paint-bench" | "orders";

const sections: Array<{ id: StudioSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "spray-plans", label: "Spray Plans" },
  { id: "paint-bench", label: "Paint Bench" },
  { id: "orders", label: "Orders" },
];

export function DashboardOverview() {
  const viewer = useQuery(api.users.viewer);
  const transactions = useQuery(api.credits.listViewerTransactions);
  const orders = useQuery(api.orders.listMine);
  const subscription = useQuery(api.subscriptions.viewerCurrent);
  const sprayPlans = useQuery(api.sprayPlans.listMine);
  const paints = useQuery(api.paintBench.listCatalog);
  const redeemActivationCode = useMutation(api.creditCampaigns.redeemActivationCode);
  const setBenchItem = useMutation(api.paintBench.setBenchItem);
  const [section, setSection] = useState<StudioSection>("overview");
  const [activationCode, setActivationCode] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [paintQuery, setPaintQuery] = useState("");
  const [updatingPaintId, setUpdatingPaintId] = useState<string | null>(null);

  const filteredPaints = useMemo(() => {
    const query = paintQuery.trim().toLowerCase();
    if (!paints || query.length === 0) return paints ?? [];
    return paints.filter((paint) =>
      [paint.brand, paint.line, paint.code, paint.colorName, paint.paintType]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [paintQuery, paints]);

  const recentTransactions = transactions?.slice(0, 5) ?? [];
  const benchCount = paints?.filter((paint) => paint.benchItem?.status === "in-stock").length ?? 0;

  async function redeemCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRedeemStatus(null);
    setRedeemError(null);
    setIsRedeeming(true);
    try {
      const response = await redeemActivationCode({ code: activationCode });
      setRedeemStatus(`${response.campaignName}: +${response.creditAmount} credits`);
      setActivationCode("");
    } catch (error) {
      setRedeemError(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setIsRedeeming(false);
    }
  }

  async function addPaintToBench(paintId: string) {
    setUpdatingPaintId(paintId);
    try {
      await setBenchItem({ paintMappingId: paintId as never, quantity: 1, status: "in-stock" });
    } finally {
      setUpdatingPaintId(null);
    }
  }

  return (
    <div className="studio-page">
      <nav aria-label="Studio sections" className="studio-tabs" role="tablist">
        {sections.map((item) => (
          <button aria-selected={section === item.id} className={section === item.id ? "is-active" : ""} key={item.id} onClick={() => setSection(item.id)} role="tab" type="button">
            {item.label}
          </button>
        ))}
      </nav>

      {section === "overview" ? (
        <div className="studio-overview" role="tabpanel">
          <section className="studio-balance-grid">
            <div className="studio-ledger-panel studio-balance">
              <header className="studio-section-head"><span>Account balance</span><small>Credit ledger / current</small></header>
              <div className="studio-balance__value"><strong>{viewer?.credits.balance ?? 0}</strong><span>Credits available</span></div>
              <dl className="studio-balance__totals">
                <div><dt>Granted</dt><dd>{viewer?.credits.lifetimeGranted ?? 0}</dd></div>
                <div><dt>Used</dt><dd>{viewer?.credits.lifetimeSpent ?? 0}</dd></div>
              </dl>
              <form
                className="studio-redeem"
                onSubmit={(event) => {
                  void redeemCode(event);
                }}
              >
                <label htmlFor="activation-code">Activation code</label>
                <div><input autoComplete="off" id="activation-code" onChange={(event) => setActivationCode(event.target.value)} placeholder="XXXX–XXXX–XXXX" value={activationCode} /><button disabled={isRedeeming || activationCode.trim().length === 0} type="submit">{isRedeeming ? "Redeeming" : "Redeem code"}</button></div>
              </form>
              {redeemStatus ? <p className="studio-notice is-success">{redeemStatus}</p> : null}
              {redeemError ? <p className="studio-notice is-error">{redeemError}</p> : null}
            </div>

            <div className="studio-ledger-panel studio-activity">
              <header className="studio-section-head"><span>Activity</span><button onClick={() => setSection("orders")} type="button">View orders →</button></header>
              {recentTransactions.length > 0 ? (
                <ol className="studio-activity-list">
                  {recentTransactions.map((transaction) => (
                    <li key={transaction._id}>
                      <time dateTime={new Date(transaction._creationTime).toISOString()}>{formatDate(transaction._creationTime)}</time>
                      <div><strong>{creditActionLabel(transaction.actionType)}</strong><span>{creditActivityDescription(transaction.actionType, transaction.balanceAfter, transaction.description)}</span></div>
                      <b className={transaction.delta >= 0 ? "is-positive" : ""}>{transaction.delta > 0 ? "+" : ""}{transaction.delta}</b>
                    </li>
                  ))}
                </ol>
              ) : <StudioEmpty compact title="No credit activity yet." copy="Grants, usage, and refunds will be recorded here." />}
            </div>
          </section>

          <SubscriptionPanel
            effectivePlan={viewer?.entitlements.planType ?? viewer?.planType ?? "free"}
            subscription={subscription}
          />

          <OrdersPanel compact orders={orders ?? []} onViewAll={() => setSection("orders")} />

          <section className="studio-tools">
            <header className="studio-section-head"><span>Production tools</span><small>Prototype → physical build</small></header>
            <div className="studio-tool-grid">
              <button onClick={() => setSection("spray-plans")} type="button"><span>01 / Workflow</span><strong>Spray Plans</strong><p>Turn generated prototypes into paint-ready sequences, surface stages, and mix references.</p><b>{sprayPlans?.length ?? 0} plans →</b></button>
              <button onClick={() => setSection("paint-bench")} type="button"><span>02 / Inventory</span><strong>Paint Bench</strong><p>Save paints, equivalents, stock state, and purchase sources for every build.</p><b>{benchCount} paints in stock →</b></button>
            </div>
          </section>
        </div>
      ) : null}

      {section === "orders" ? <OrdersPanel orders={orders ?? []} /> : null}

      {section === "spray-plans" ? (
        <section className="studio-record-section" role="tabpanel">
          <header className="studio-record-header"><div><span>Production / Spray plans</span><h2>Paint-ready workflows</h2></div><a href="/library">Select a prototype in Library →</a></header>
          {sprayPlans && sprayPlans.length > 0 ? (
            <div className="studio-plan-list">
              {sprayPlans.map((plan) => (
                <article key={plan._id}>
                  <header><span>N°.{String(plan.conceptRecordNumber ?? 0).padStart(3, "0")}</span><small>Version {plan.currentVersion} / {plan.status}</small></header>
                  <h3>{plan.title}</h3><p>{plan.snapshot?.baseModelName ?? "Prototype source"} · {plan.snapshot?.stylePresetName ?? "Style DNA pending"}</p>
                  <ol>{(plan.snapshot?.entries ?? []).slice(0, 4).map((entry: PlanEntry, index: number) => <li key={entry.roleSlug}><span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.roleName}</strong><b>{entry.suggestedPaint ? `${entry.suggestedPaint.code} ${entry.suggestedPaint.colorName}` : "Mapping pending"}</b></li>)}</ol>
                </article>
              ))}
            </div>
          ) : <StudioEmpty title="No spray plans yet." copy="Open a generated prototype in Library and choose Generate Spray Plan." href="/library" link="Open Library →" />}
        </section>
      ) : null}

      {section === "paint-bench" ? (
        <section className="studio-record-section" role="tabpanel">
          <header className="studio-record-header"><div><span>Production / Paint bench</span><h2>Catalog and inventory</h2></div><label className="studio-paint-search"><span>Search paints</span><input onChange={(event) => setPaintQuery(event.target.value)} placeholder="Brand, code, color…" type="search" value={paintQuery} /></label></header>
          <div className="studio-paint-list">
            {filteredPaints.map((paint) => (
              <article key={paint._id}>
                <i aria-hidden="true" style={{ background: paint.hexPreview ?? "var(--color-rule)" }} />
                <div><span>{paint.brand}{paint.line ? ` / ${paint.line}` : ""}</span><strong>{paint.code} {paint.colorName}</strong><small>{paint.paintType ?? "Paint"} · {paint.finishType ?? "Finish not specified"}</small></div>
                <div className="studio-paint-stock"><span>{paint.benchItem?.status ?? "Not in bench"}</span><b>{paint.benchItem ? `${paint.benchItem.quantity} on hand` : "—"}</b></div>
                <div className="studio-paint-actions">{paint.purchaseSources[0] ? <a href={paint.purchaseSources[0].url} rel="noreferrer" target="_blank">Find paint ↗</a> : null}<button disabled={updatingPaintId === paint._id} onClick={() => void addPaintToBench(paint._id)} type="button">{paint.benchItem ? "Mark in stock" : "Add to bench"}</button></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type PlanEntry = { roleSlug: string; roleName: string; suggestedPaint?: { code: string; colorName: string } | null };

function SubscriptionPanel({ effectivePlan, subscription }: {
  effectivePlan: string;
  subscription: {
    planType: string;
    pendingPlanType?: string;
    pendingPlanEffectiveAt?: number;
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
    gracePeriodEndsAt?: number;
  } | null | undefined;
}) {
  return (
    <section className="studio-subscription">
      <header className="studio-section-head"><span>Plan & entitlements</span><small>Credits remain a separate balance</small></header>
      <dl>
        <div><dt>Effective plan</dt><dd>{formatLabel(effectivePlan)}</dd></div>
        <div><dt>Subscription</dt><dd>{subscription === undefined ? "Loading" : subscription ? formatLabel(subscription.status) : "No subscription"}</dd></div>
        <div><dt>Current period</dt><dd>{subscription ? `Ends ${formatDate(subscription.currentPeriodEnd)}` : "Credit packs only"}</dd></div>
        <div><dt>Next change</dt><dd>{subscription?.pendingPlanType ? `${formatLabel(subscription.pendingPlanType)} on ${formatDate(subscription.pendingPlanEffectiveAt ?? subscription.currentPeriodEnd)}` : subscription?.cancelAtPeriodEnd ? `Cancellation after ${formatDate(subscription.currentPeriodEnd)}` : subscription?.status === "past-due" && subscription.gracePeriodEndsAt ? `Grace through ${formatDate(subscription.gracePeriodEndsAt)}` : "None scheduled"}</dd></div>
      </dl>
    </section>
  );
}

function OrdersPanel({ compact = false, onViewAll, orders }: { compact?: boolean; onViewAll?: () => void; orders: Array<OrderRecord> }) {
  return (
    <section className={compact ? "studio-orders is-compact" : "studio-orders"} role="tabpanel">
      <header className="studio-section-head"><span>Orders</span>{compact && onViewAll ? <button onClick={onViewAll} type="button">View orders →</button> : <small>Purchases and production services</small>}</header>
      <div className="studio-order-head" aria-hidden="true"><span>Order</span><span>Type</span><span>Status</span><span>Total</span><span>Date</span></div>
      {orders.length > 0 ? orders.map((order) => <article className="studio-order-row" key={order._id}><strong>{order.orderNumber}</strong><span>{order.items.map((item) => item.title).join(", ")}</span><b>{order.status}</b><span>{formatMoney(order.totalMinor, order.currency)}</span><time>{formatDate(order.completedAt ?? order._creationTime)}</time></article>) : <StudioEmpty compact title="No orders yet." copy="Purchases and production services will appear here." />}
    </section>
  );
}

type OrderRecord = { _id: string; _creationTime: number; orderNumber: string; status: string; currency: string; totalMinor: number; completedAt?: number; items: Array<{ title: string }> };

function StudioEmpty({ compact = false, copy, href, link, title }: { compact?: boolean; copy: string; href?: string; link?: string; title: string }) {
  return <div className={compact ? "studio-empty compact" : "studio-empty"}><strong>{title}</strong><p>{copy}</p>{href && link ? <a href={href}>{link}</a> : null}</div>;
}

function formatDate(value: number) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(value); }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { style: "currency", currency }).format(value / 100); }
function formatLabel(value: string) { return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function creditActionLabel(action: string) { return ({ "starter-grant": "Account activated", "campaign-code-redemption": "Activation code redeemed", "generation-refund": "Generation refund", "admin-adjustment": "Account adjustment" } as Record<string, string>)[action] ?? action.replaceAll("-", " "); }
function creditActivityDescription(action: string, balanceAfter: number, description?: string) {
  if (action === "starter-grant") return `Starter credit balance established at ${balanceAfter}.`;
  return description ?? `Credit balance updated to ${balanceAfter}.`;
}
