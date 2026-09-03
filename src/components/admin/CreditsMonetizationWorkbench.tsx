import {
  BarChartIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import type { AdminCreditsSearch } from "./adminRouteSearch";

type CreditsTab = NonNullable<AdminCreditsSearch["tab"]>;
type ConsoleData = NonNullable<FunctionReturnType<typeof api.admin.getCreditsConsole>>;
type CreditTransaction = ConsoleData["transactions"][number];
type Campaigns = NonNullable<FunctionReturnType<typeof api.creditCampaigns.listAdminCampaigns>>;
type Campaign = Campaigns[number];
type PriceRules = NonNullable<FunctionReturnType<typeof api.admin.listPriceRules>>;
type DirectionFilter = "all" | "inflow" | "outflow";

type CampaignDraft = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  defaultCreditAmount: string;
  maxRedemptions: string;
  perUserLimit: string;
};

type CodeDraft = {
  count: string;
  creditAmount: string;
  maxRedemptionsPerCode: string;
  prefix: string;
  expiresAt: string;
};

const tabs: Array<{ value: CreditsTab; label: string; icon: ReactNode }> = [
  { value: "overview", label: "Overview", icon: <BarChartIcon /> },
  { value: "ledger", label: "Ledger", icon: <CodeIcon /> },
  { value: "rewards", label: "Rewards", icon: <PlusIcon /> },
  { value: "pricing", label: "Pricing", icon: <MixerHorizontalIcon /> },
];

export function CreditsMonetizationWorkbench({ search }: { search: AdminCreditsSearch }) {
  const navigate = useNavigate();
  const consoleData = useQuery(api.admin.getCreditsConsole);
  const campaigns = useQuery(api.creditCampaigns.listAdminCampaigns);
  const priceRules = useQuery(api.admin.listPriceRules);
  const createCampaign = useMutation(api.creditCampaigns.createCampaign);
  const updateCampaign = useMutation(api.creditCampaigns.updateCampaign);
  const generateActivationCodes = useMutation(api.creditCampaigns.generateActivationCodes);
  const setActivationCodeActive = useMutation(api.creditCampaigns.setActivationCodeActive);
  const updatePriceRule = useMutation(api.admin.updatePriceRule);
  const activeTab = search.tab ?? "overview";
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [showCampaignComposer, setShowCampaignComposer] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(defaultCampaignDraft);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, CodeDraft>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { cost: string; active: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "rewards" || search.campaign || !campaigns?.[0]) return;
    void navigate({
      to: "/admin/credits",
      search: { tab: "rewards", campaign: campaigns[0]._id },
      replace: true,
    });
  }, [activeTab, campaigns, navigate, search.campaign]);

  const selectedCampaign = campaigns?.find((campaign) => campaign._id === search.campaign) ?? null;
  const filteredTransactions = useMemo(() => {
    if (!consoleData) return [];
    const query = ledgerSearch.trim().toLowerCase();
    return consoleData.transactions.filter((transaction) => {
      if (direction === "inflow" && transaction.delta <= 0) return false;
      if (direction === "outflow" && transaction.delta >= 0) return false;
      if (!query) return true;
      return [
        transaction.user?.fullName,
        transaction.user?.email,
        transaction.user?.handle,
        transaction.actionType,
        transaction.sourceType,
        transaction.description,
        transaction.campaign?.name,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [consoleData, direction, ledgerSearch]);

  function selectTab(tab: CreditsTab) {
    void navigate({
      to: "/admin/credits",
      search: { tab, campaign: tab === "rewards" ? search.campaign : undefined },
      replace: true,
    });
  }

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "The operation could not be completed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitCampaign() {
    await runAction("create-campaign", async () => {
      const result = await createCampaign({
        name: campaignDraft.name,
        description: optionalText(campaignDraft.description),
        startsAt: parseDateTime(campaignDraft.startsAt, "Start time"),
        endsAt: parseDateTime(campaignDraft.endsAt, "End time"),
        defaultCreditAmount: parsePositiveInteger(campaignDraft.defaultCreditAmount, "Credits"),
        maxRedemptions: parseOptionalPositiveInteger(campaignDraft.maxRedemptions, "Redemption cap"),
        perUserLimit: parsePositiveInteger(campaignDraft.perUserLimit, "Per-user limit"),
        isActive: true,
      });
      setCampaignDraft(defaultCampaignDraft());
      setShowCampaignComposer(false);
      void navigate({
        to: "/admin/credits",
        search: { tab: "rewards", campaign: result.campaignId },
        replace: true,
      });
    }, "Reward campaign created and activated.");
  }

  async function submitCodes(campaign: Campaign) {
    const draft = codeDrafts[campaign._id] ?? defaultCodeDraft(campaign);
    await runAction(`generate-${campaign._id}`, async () => {
      const result = await generateActivationCodes({
        campaignId: campaign._id,
        count: parsePositiveInteger(draft.count, "Code count"),
        creditAmount: parsePositiveInteger(draft.creditAmount, "Credits per code"),
        maxRedemptionsPerCode: parsePositiveInteger(
          draft.maxRedemptionsPerCode,
          "Redemptions per code"
        ),
        prefix: optionalText(draft.prefix),
        expiresAt: parseOptionalDateTime(draft.expiresAt, "Code expiry"),
      });
      if (result.codes[0]) await copyCode(result.codes[0]);
    }, "Activation codes generated. The first code was copied.");
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((current) => current === code ? null : current), 1800);
  }

  return (
    <main className="credits-console">
      <header className="credits-console__hero">
        <div className="credits-console__title">
          <p>Monetization operations</p>
          <h2>Credits, pricing and rewards.</h2>
          <span>Monitor capacity economics and issue rewards without obscuring user cost.</span>
        </div>
        <div className="credits-console__pulse">
          <span aria-hidden="true" />
          <div><small>Ledger status</small><strong>Operational</strong></div>
          <em>{consoleData?.summary.transactionCount ?? 0} ledger entries</em>
        </div>
      </header>

      <CreditMetrics data={consoleData} />

      <nav aria-label="Credits workspaces" className="credits-console__tabs">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={cn(activeTab === tab.value && "is-active")}
            key={tab.value}
            onClick={() => selectTab(tab.value)}
            type="button"
          >
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {message ? <p className={cn("credits-console__message", `is-${message.tone}`)} role="status">{message.text}</p> : null}

      {activeTab === "overview" ? (
        <OverviewTab data={consoleData} campaigns={campaigns} priceRules={priceRules} onOpenTab={selectTab} />
      ) : null}
      {activeTab === "ledger" ? (
        <LedgerTab
          data={consoleData}
          direction={direction}
          filteredTransactions={filteredTransactions}
          query={ledgerSearch}
          setDirection={setDirection}
          setQuery={setLedgerSearch}
        />
      ) : null}
      {activeTab === "rewards" ? (
        <RewardsTab
          busy={busy}
          campaignDraft={campaignDraft}
          campaigns={campaigns}
          codeDrafts={codeDrafts}
          copiedCode={copiedCode}
          onCopyCode={copyCode}
          onCreateCampaign={submitCampaign}
          onGenerateCodes={submitCodes}
          onSelectCampaign={(campaignId) => void navigate({ to: "/admin/credits", search: { tab: "rewards", campaign: campaignId } })}
          onSetCodeActive={(codeId, isActive) => void runAction(`code-${codeId}`, () => setActivationCodeActive({ activationCodeId: codeId, isActive }), isActive ? "Activation code enabled." : "Activation code paused.")}
          onToggleCampaign={(campaign) => void runAction(`campaign-${campaign._id}`, () => updateCampaign({ campaignId: campaign._id, isActive: !campaign.isActive }), campaign.isActive ? "Campaign paused." : "Campaign activated.")}
          selectedCampaign={selectedCampaign}
          setCampaignDraft={setCampaignDraft}
          setCodeDrafts={setCodeDrafts}
          setShowCampaignComposer={setShowCampaignComposer}
          showCampaignComposer={showCampaignComposer}
        />
      ) : null}
      {activeTab === "pricing" ? (
        <PricingTab
          busy={busy}
          drafts={priceDrafts}
          onSave={(rule, draft) => void runAction(`price-${rule._id}`, () => updatePriceRule({ priceRuleId: rule._id, creditCost: parseNonNegativeInteger(draft.cost, "Credit cost"), isActive: draft.active }), `${rule.label} pricing updated.`)}
          priceRules={priceRules}
          setDrafts={setPriceDrafts}
        />
      ) : null}
    </main>
  );
}

function CreditMetrics({ data }: { data: ConsoleData | undefined }) {
  const summary = data?.summary;
  const revenue = summary?.revenueByCurrency[0];
  return (
    <dl className="credits-metrics">
      <Metric label="Credits in circulation" value={summary ? formatNumber(summary.circulatingCredits) : undefined} detail={summary ? `${summary.activeAccountCount} active accounts / 30d` : undefined} />
      <Metric label="Lifetime consumed" value={summary ? formatNumber(summary.lifetimeSpent) : undefined} detail={summary ? `${ratio(summary.lifetimeSpent, summary.lifetimeGranted)} utilization` : undefined} />
      <Metric label="Purchased credits" value={summary ? formatNumber(summary.purchasedCredits) : undefined} detail="Ledger-attributed purchases" />
      <Metric label="Paid revenue" value={revenue ? formatMoney(revenue.totalMinor, revenue.currency) : summary ? "$0.00" : undefined} detail={summary ? `${summary.paidOrderCount} paid orders` : undefined} />
      <Metric label="Rewarded credits" value={summary ? formatNumber(summary.rewardedCredits) : undefined} detail={summary ? `${ratio(summary.rewardedCredits, summary.lifetimeGranted)} of grants` : undefined} />
    </dl>
  );
}

function Metric({ detail, label, value }: { detail?: string; label: string; value?: string }) {
  return <div><dt>{label}</dt><dd>{value ?? "..."}</dd><small>{detail ?? "Loading ledger"}</small></div>;
}

function OverviewTab({ data, campaigns, priceRules, onOpenTab }: { data: ConsoleData | undefined; campaigns: Campaigns | undefined; priceRules: PriceRules | undefined; onOpenTab: (tab: CreditsTab) => void }) {
  const flow = useMemo(() => buildDailyFlow(data?.transactions ?? []), [data]);
  const maxFlow = Math.max(1, ...flow.flatMap((day) => [day.inflow, day.outflow]));
  const activeCampaigns = campaigns?.filter((campaign) => campaignStatus(campaign) === "live") ?? [];
  return (
    <div className="credits-overview">
      <section className="credit-flow-panel">
        <SectionHeader eyebrow="Last 14 days" title="Credit flow" action={<button onClick={() => onOpenTab("ledger")} type="button">Open ledger</button>} />
        <div className="credit-flow-chart" aria-label="Daily credit inflow and outflow">
          {flow.map((day) => (
            <div className="credit-flow-day" key={day.key} title={`${day.label}: +${day.inflow} / -${day.outflow}`}>
              <div className="credit-flow-day__bars">
                <span className="is-inflow" style={{ height: `${Math.max(2, day.inflow / maxFlow * 100)}%` }} />
                <span className="is-outflow" style={{ height: `${Math.max(2, day.outflow / maxFlow * 100)}%` }} />
              </div>
              <small>{day.shortLabel}</small>
            </div>
          ))}
        </div>
        <div className="credit-flow-legend"><span><i className="is-inflow" />Grants & purchases</span><span><i className="is-outflow" />Consumption</span></div>
      </section>

      <section className="credit-allocation-panel">
        <SectionHeader eyebrow="Liability" title="Balance allocation" />
        <div className="credit-allocation-list">
          {data === undefined ? <LoadingState /> : data.accounts.length === 0 ? <EmptyState label="No credit accounts yet." /> : data.accounts.slice(0, 6).map((account) => (
            <div key={account._id}>
              <span><strong>{account.user?.fullName ?? "Deleted user"}</strong><small>{account.user ? `@${account.user.handle} / ${account.user.planType}` : "Unlinked account"}</small></span>
              <em>{formatNumber(account.balance)}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="credit-live-panel">
        <SectionHeader eyebrow="Rewards" title="Live campaigns" action={<button onClick={() => onOpenTab("rewards")} type="button">Manage</button>} />
        {campaigns === undefined ? <LoadingState /> : activeCampaigns.length === 0 ? <EmptyState label="No reward campaign is live." /> : activeCampaigns.slice(0, 4).map((campaign) => (
          <article className="credit-live-row" key={campaign._id}>
            <div><strong>{campaign.name}</strong><span>{campaign.activeCodeCount} active codes</span></div>
            <div><em>{campaign.totalRedemptions}</em><small>redemptions</small></div>
          </article>
        ))}
      </section>

      <section className="credit-pricing-panel">
        <SectionHeader eyebrow="Unit economics" title="Active pricing" action={<button onClick={() => onOpenTab("pricing")} type="button">Tune rules</button>} />
        {priceRules === undefined ? <LoadingState /> : priceRules.filter((rule) => rule.isActive).slice(0, 6).map((rule) => (
          <div className="credit-price-preview" key={rule._id}><span>{rule.label}<small>{formatWords(rule.actionType)}</small></span><strong>{rule.creditCost}<small> cr</small></strong></div>
        ))}
      </section>
    </div>
  );
}

function LedgerTab({ data, direction, filteredTransactions, query, setDirection, setQuery }: { data: ConsoleData | undefined; direction: DirectionFilter; filteredTransactions: CreditTransaction[]; query: string; setDirection: (value: DirectionFilter) => void; setQuery: (value: string) => void }) {
  return (
    <section className="credit-ledger-workspace">
      <header className="credit-workspace-title"><div><p>Audit surface</p><h3>Transaction ledger</h3></div><span>{filteredTransactions.length} entries shown</span></header>
      <div className="credit-ledger-controls">
        <label><MagnifyingGlassIcon /><span className="sr-only">Search transactions</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search user, action, campaign" value={query} /></label>
        <div className="credit-segmented" aria-label="Filter transaction direction">
          {(["all", "inflow", "outflow"] as const).map((value) => <button className={cn(direction === value && "is-active")} key={value} onClick={() => setDirection(value)} type="button">{formatWords(value)}</button>)}
        </div>
      </div>
      <div className="credit-ledger-table" role="table" aria-label="Credit transactions">
        <div className="credit-ledger-row is-head" role="row"><span>User</span><span>Source</span><span>Description</span><span>Change</span><span>Balance</span><span>Time</span></div>
        {data === undefined ? <LoadingState /> : filteredTransactions.length === 0 ? <EmptyState label="No transactions match this view." /> : filteredTransactions.map((transaction) => (
          <div className="credit-ledger-row" key={transaction._id} role="row">
            <span><strong>{transaction.user?.fullName ?? "Deleted user"}</strong><small>{transaction.user?.email ?? transaction.user?.handle ?? "Unlinked"}</small></span>
            <span><SourceMark source={transaction.sourceType} /><small>{transaction.campaign?.name ?? formatWords(transaction.actionType)}</small></span>
            <span>{transaction.description ?? "No description"}</span>
            <strong className={transaction.delta >= 0 ? "is-positive" : "is-negative"}>{signedNumber(transaction.delta)}</strong>
            <em>{formatNumber(transaction.balanceAfter)}</em>
            <time dateTime={new Date(transaction._creationTime).toISOString()}>{formatDateTime(transaction._creationTime)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

function RewardsTab({ busy, campaignDraft, campaigns, codeDrafts, copiedCode, onCopyCode, onCreateCampaign, onGenerateCodes, onSelectCampaign, onSetCodeActive, onToggleCampaign, selectedCampaign, setCampaignDraft, setCodeDrafts, setShowCampaignComposer, showCampaignComposer }: {
  busy: string | null;
  campaignDraft: CampaignDraft;
  campaigns: Campaigns | undefined;
  codeDrafts: Record<string, CodeDraft>;
  copiedCode: string | null;
  onCopyCode: (code: string) => Promise<void>;
  onCreateCampaign: () => Promise<void>;
  onGenerateCodes: (campaign: Campaign) => Promise<void>;
  onSelectCampaign: (campaignId: string) => void;
  onSetCodeActive: (codeId: Id<"creditActivationCodes">, isActive: boolean) => void;
  onToggleCampaign: (campaign: Campaign) => void;
  selectedCampaign: Campaign | null;
  setCampaignDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  setCodeDrafts: React.Dispatch<React.SetStateAction<Record<string, CodeDraft>>>;
  setShowCampaignComposer: (value: boolean) => void;
  showCampaignComposer: boolean;
}) {
  return (
    <section className="rewards-workspace">
      <aside className="reward-campaign-rail">
        <header><div><p>Distribution</p><h3>Reward campaigns</h3></div><button aria-label="Create reward campaign" onClick={() => setShowCampaignComposer(true)} title="Create campaign" type="button"><PlusIcon /></button></header>
        <div className="reward-campaign-list">
          {campaigns === undefined ? <LoadingState /> : campaigns.length === 0 ? <EmptyState label="No campaigns yet." /> : campaigns.map((campaign) => (
            <button className={cn("reward-campaign-row", selectedCampaign?._id === campaign._id && "is-active")} key={campaign._id} onClick={() => onSelectCampaign(campaign._id)} type="button">
              <span className={cn("reward-status-dot", `is-${campaignStatus(campaign)}`)} />
              <span><strong>{campaign.name}</strong><small>{formatShortDate(campaign.startsAt)} - {formatShortDate(campaign.endsAt)}</small></span>
              <em>{campaign.totalRedemptions}</em>
            </button>
          ))}
        </div>
      </aside>

      <div className="reward-campaign-inspector">
        {showCampaignComposer ? (
          <CampaignComposer busy={busy === "create-campaign"} draft={campaignDraft} onCancel={() => setShowCampaignComposer(false)} onChange={setCampaignDraft} onSubmit={onCreateCampaign} />
        ) : selectedCampaign ? (
          <CampaignInspector
            busy={busy}
            campaign={selectedCampaign}
            codeDraft={codeDrafts[selectedCampaign._id] ?? defaultCodeDraft(selectedCampaign)}
            copiedCode={copiedCode}
            onCopyCode={onCopyCode}
            onGenerate={() => onGenerateCodes(selectedCampaign)}
            onSetCodeActive={onSetCodeActive}
            onToggle={() => onToggleCampaign(selectedCampaign)}
            setCodeDraft={(draft) => setCodeDrafts((current) => ({ ...current, [selectedCampaign._id]: draft }))}
          />
        ) : <EmptyState label="Select a reward campaign or create a new one." />}
      </div>
    </section>
  );
}

function CampaignComposer({ busy, draft, onCancel, onChange, onSubmit }: { busy: boolean; draft: CampaignDraft; onCancel: () => void; onChange: React.Dispatch<React.SetStateAction<CampaignDraft>>; onSubmit: () => Promise<void> }) {
  return (
    <div className="reward-composer">
      <header><div><p>New distribution</p><h3>Create reward campaign</h3></div><button onClick={onCancel} type="button">Cancel</button></header>
      <div className="reward-form-grid">
        <Field label="Campaign name" wide><input autoFocus onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} placeholder="Pilot cohort thank-you" value={draft.name} /></Field>
        <Field label="Starts"><input onChange={(event) => onChange((current) => ({ ...current, startsAt: event.target.value }))} type="datetime-local" value={draft.startsAt} /></Field>
        <Field label="Ends"><input onChange={(event) => onChange((current) => ({ ...current, endsAt: event.target.value }))} type="datetime-local" value={draft.endsAt} /></Field>
        <Field label="Credits / code"><input min="1" onChange={(event) => onChange((current) => ({ ...current, defaultCreditAmount: event.target.value }))} type="number" value={draft.defaultCreditAmount} /></Field>
        <Field label="Campaign cap"><input min="1" onChange={(event) => onChange((current) => ({ ...current, maxRedemptions: event.target.value }))} placeholder="Unlimited" type="number" value={draft.maxRedemptions} /></Field>
        <Field label="Per-user limit"><input min="1" onChange={(event) => onChange((current) => ({ ...current, perUserLimit: event.target.value }))} type="number" value={draft.perUserLimit} /></Field>
        <Field label="Internal description" wide><textarea onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} placeholder="Who receives this reward and why?" value={draft.description} /></Field>
      </div>
      <footer><span>Campaign starts active. Codes are generated after creation.</span><button disabled={busy || !draft.name.trim()} onClick={() => void onSubmit()} type="button">{busy ? <ReloadIcon /> : <PlusIcon />}{busy ? "Creating" : "Create campaign"}</button></footer>
    </div>
  );
}

function CampaignInspector({ busy, campaign, codeDraft, copiedCode, onCopyCode, onGenerate, onSetCodeActive, onToggle, setCodeDraft }: {
  busy: string | null;
  campaign: Campaign;
  codeDraft: CodeDraft;
  copiedCode: string | null;
  onCopyCode: (code: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  onSetCodeActive: (codeId: Id<"creditActivationCodes">, isActive: boolean) => void;
  onToggle: () => void;
  setCodeDraft: (draft: CodeDraft) => void;
}) {
  const status = campaignStatus(campaign);
  return (
    <>
      <header className="reward-inspector-head">
        <div><p>{status} campaign</p><h3>{campaign.name}</h3><span>{campaign.description ?? "No internal campaign description."}</span></div>
        <button className={campaign.isActive ? "is-danger" : "is-primary"} disabled={busy === `campaign-${campaign._id}`} onClick={onToggle} type="button">{campaign.isActive ? "Pause campaign" : "Activate campaign"}</button>
      </header>
      <dl className="reward-campaign-metrics">
        <div><dt>Reward</dt><dd>{campaign.defaultCreditAmount}<small> cr</small></dd></div>
        <div><dt>Redemptions</dt><dd>{campaign.totalRedemptions}<small>{campaign.maxRedemptions ? ` / ${campaign.maxRedemptions}` : " / unlimited"}</small></dd></div>
        <div><dt>Codes live</dt><dd>{campaign.activeCodeCount}<small> / {campaign.codeCount}</small></dd></div>
        <div><dt>Per user</dt><dd>{campaign.perUserLimit}<small> max</small></dd></div>
      </dl>
      <section className="reward-code-generator">
        <SectionHeader eyebrow="Inventory" title="Generate activation codes" />
        <div className="reward-code-fields">
          <Field label="Quantity"><input min="1" max="200" onChange={(event) => setCodeDraft({ ...codeDraft, count: event.target.value })} type="number" value={codeDraft.count} /></Field>
          <Field label="Credits"><input min="1" onChange={(event) => setCodeDraft({ ...codeDraft, creditAmount: event.target.value })} type="number" value={codeDraft.creditAmount} /></Field>
          <Field label="Uses / code"><input min="1" onChange={(event) => setCodeDraft({ ...codeDraft, maxRedemptionsPerCode: event.target.value })} type="number" value={codeDraft.maxRedemptionsPerCode} /></Field>
          <Field label="Prefix"><input maxLength={12} onChange={(event) => setCodeDraft({ ...codeDraft, prefix: event.target.value.toUpperCase() })} value={codeDraft.prefix} /></Field>
          <Field label="Expires"><input onChange={(event) => setCodeDraft({ ...codeDraft, expiresAt: event.target.value })} type="datetime-local" value={codeDraft.expiresAt} /></Field>
          <button disabled={busy === `generate-${campaign._id}`} onClick={() => void onGenerate()} type="button">{busy === `generate-${campaign._id}` ? <ReloadIcon /> : <CodeIcon />}{busy === `generate-${campaign._id}` ? "Generating" : "Generate codes"}</button>
        </div>
      </section>
      <section className="reward-code-inventory">
        <SectionHeader eyebrow="Recent batch inventory" title="Activation codes" />
        {campaign.codes.length === 0 ? <EmptyState label="No activation codes generated." /> : campaign.codes.map((code) => (
          <div className="reward-code-row" key={code._id}>
            <button aria-label={`Copy ${code.code}`} className="reward-code-copy" onClick={() => void onCopyCode(code.code)} title="Copy activation code" type="button">{copiedCode === code.code ? <CheckIcon /> : <CopyIcon />}</button>
            <code>{code.code}</code>
            <span>{code.creditAmount} cr</span>
            <span>{code.redemptionCount} / {code.maxRedemptions} used</span>
            <time>{code.expiresAt ? formatShortDate(code.expiresAt) : "No expiry"}</time>
            <button className={cn("reward-code-toggle", code.isActive && "is-active")} disabled={busy === `code-${code._id}`} onClick={() => onSetCodeActive(code._id, !code.isActive)} type="button">{code.isActive ? "Active" : "Paused"}</button>
          </div>
        ))}
      </section>
    </>
  );
}

function PricingTab({ busy, drafts, onSave, priceRules, setDrafts }: { busy: string | null; drafts: Record<string, { cost: string; active: boolean }>; onSave: (rule: PriceRules[number], draft: { cost: string; active: boolean }) => void; priceRules: PriceRules | undefined; setDrafts: React.Dispatch<React.SetStateAction<Record<string, { cost: string; active: boolean }>>> }) {
  return (
    <section className="credit-pricing-workspace">
      <header className="credit-workspace-title"><div><p>Cost controls</p><h3>Generation price rules</h3></div><span>Changes affect the next eligible action.</span></header>
      <div className="credit-pricing-note"><strong>Transparent capacity pricing</strong><p>Keep high-frequency exploration inexpensive and reserve larger costs for provider-heavy output. Disabled rules remain visible for audit context.</p></div>
      <div className="credit-pricing-table">
        <div className="credit-pricing-row is-head"><span>Action</span><span>Purpose</span><span>Credit cost</span><span>Status</span><span /></div>
        {priceRules === undefined ? <LoadingState /> : priceRules.map((rule) => {
          const draft = drafts[rule._id] ?? { cost: String(rule.creditCost), active: rule.isActive };
          const dirty = draft.cost !== String(rule.creditCost) || draft.active !== rule.isActive;
          return (
            <div className="credit-pricing-row" key={rule._id}>
              <span><strong>{rule.label}</strong><small>{formatWords(rule.actionType)}</small></span>
              <p>{rule.description ?? "No pricing note."}</p>
              <label><span className="sr-only">Credit cost for {rule.label}</span><input min="0" onChange={(event) => setDrafts((current) => ({ ...current, [rule._id]: { ...draft, cost: event.target.value } }))} type="number" value={draft.cost} /><small>credits</small></label>
              <button aria-pressed={draft.active} className={cn("credit-rule-switch", draft.active && "is-active")} onClick={() => setDrafts((current) => ({ ...current, [rule._id]: { ...draft, active: !draft.active } }))} type="button"><i /><span>{draft.active ? "Active" : "Paused"}</span></button>
              <button className="credit-rule-save" disabled={!dirty || busy === `price-${rule._id}`} onClick={() => onSave(rule, draft)} type="button">{busy === `price-${rule._id}` ? "Saving" : "Save"}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field({ children, label, wide = false }: { children: ReactNode; label: string; wide?: boolean }) {
  return <label className={cn("credit-field", wide && "is-wide")}><span>{label}</span>{children}</label>;
}

function SectionHeader({ action, eyebrow, title }: { action?: ReactNode; eyebrow: string; title: string }) {
  return <header className="credit-section-head"><div><p>{eyebrow}</p><h3>{title}</h3></div>{action}</header>;
}

function LoadingState() { return <div className="credit-state"><ReloadIcon /><span>Loading live data</span></div>; }
function EmptyState({ label }: { label: string }) { return <div className="credit-state"><span>{label}</span></div>; }
function SourceMark({ source }: { source: string }) { return <strong className={cn("credit-source", sourceTone(source))}>{formatWords(source)}</strong>; }

function buildDailyFlow(transactions: CreditTransaction[]) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const key = dayKey(date.getTime());
    return { key, label: formatter.format(date), shortLabel: index % 2 === 0 ? String(date.getDate()) : "", inflow: 0, outflow: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  for (const transaction of transactions) {
    const day = byKey.get(dayKey(transaction._creationTime));
    if (!day) continue;
    if (transaction.delta > 0) day.inflow += transaction.delta;
    else day.outflow += Math.abs(transaction.delta);
  }
  return days;
}

function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function defaultCampaignDraft(): CampaignDraft {
  const now = Date.now();
  return { name: "", description: "", startsAt: formatDateTimeInput(now), endsAt: formatDateTimeInput(now + 7 * 24 * 60 * 60 * 1000), defaultCreditAmount: "20", maxRedemptions: "", perUserLimit: "1" };
}

function defaultCodeDraft(campaign: Pick<Campaign, "defaultCreditAmount" | "endsAt" | "name">): CodeDraft {
  return { count: "10", creditAmount: String(campaign.defaultCreditAmount), maxRedemptionsPerCode: "1", prefix: derivePrefix(campaign.name), expiresAt: formatDateTimeInput(campaign.endsAt) };
}

function derivePrefix(name: string) {
  const value = name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8);
  return value.length >= 2 ? value : "NTL";
}

function campaignStatus(campaign: Campaign) {
  const now = Date.now();
  if (!campaign.isActive) return "paused";
  if (now < campaign.startsAt) return "scheduled";
  if (now > campaign.endsAt) return "ended";
  if (campaign.maxRedemptions !== undefined && campaign.totalRedemptions >= campaign.maxRedemptions) return "ended";
  return "live";
}

function sourceTone(source: string) {
  if (source === "purchased") return "is-purchased";
  if (source.includes("refund")) return "is-refund";
  if (source.includes("generation") && !source.includes("refund")) return "is-spend";
  return "is-reward";
}

function parsePositiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
}

function parseOptionalPositiveInteger(value: string, label: string) { return value.trim() ? parsePositiveInteger(value, label) : undefined; }
function parseDateTime(value: string, label: string) { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${label} must be valid.`); return parsed; }
function parseOptionalDateTime(value: string, label: string) { return value.trim() ? parseDateTime(value, label) : undefined; }
function optionalText(value: string) { return value.trim() || undefined; }
function formatDateTimeInput(timestamp: number) { const date = new Date(timestamp); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000); return local.toISOString().slice(0, 16); }
function formatDateTime(timestamp: number) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(timestamp); }
function formatShortDate(timestamp: number) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "2-digit" }).format(timestamp); }
function formatNumber(value: number) { return new Intl.NumberFormat("en").format(value); }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { style: "currency", currency }).format(value / 100); }
function formatWords(value: string) { return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function signedNumber(value: number) { return `${value > 0 ? "+" : ""}${formatNumber(value)}`; }
function ratio(value: number, total: number) { return total <= 0 ? "0%" : `${Math.round(value / total * 100)}%`; }
