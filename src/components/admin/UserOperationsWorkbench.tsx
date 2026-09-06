import {
  CheckCircledIcon,
  ChevronRightIcon,
  ClockIcon,
  CrossCircledIcon,
  DotsHorizontalIcon,
  ExternalLinkIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AdminUsersSearch } from "./adminRouteSearch";

type UserTab = NonNullable<AdminUsersSearch["tab"]>;
type DirectoryFilter = "all" | "active" | "pro" | "flagged";
type ActivityFilter = "all" | "generation" | "concept" | "feedback" | "credits" | "account";
type AccessAction = "suspend" | "restore" | "grant-admin" | "remove-admin" | null;
type OverviewData = NonNullable<FunctionReturnType<typeof api.adminUsers.getOverview>>;
type ActivityData = FunctionReturnType<typeof api.adminUsers.listActivity>;
type ActivityItem = ActivityData[number];
type LedgerData = FunctionReturnType<typeof api.adminUsers.listCreditLedger>;
type FeedbackData = FunctionReturnType<typeof api.adminUsers.listFeedback>;
type NotesData = FunctionReturnType<typeof api.adminUsers.listNotes>;
type EntitlementAccessData = NonNullable<FunctionReturnType<typeof api.adminUsers.getEntitlementAccess>>;
type EntitlementGrantDraft = {
  sourceType: "manual" | "promotion" | "early-adopter";
  storageGb: string;
  originalRetentionDays: string;
  expiryDays: string;
  originalDownloadAllowed: boolean;
  batchDownloadAllowed: boolean;
  note: string;
};
type AccessPatch = {
  planType?: "free" | "pro" | "studio";
  accountStatus?: "active" | "suspended";
  isAdmin?: boolean;
  isVerifiedCreator?: boolean;
  isFeaturedCreator?: boolean;
};

const tabs: Array<{ value: UserTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "credits", label: "Credits" },
  { value: "feedback", label: "Feedback" },
  { value: "access", label: "Access" },
];

const directoryFilters: Array<{ value: DirectoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pro", label: "Pro" },
  { value: "flagged", label: "Flagged" },
];

const activityFilters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "generation", label: "Generation" },
  { value: "concept", label: "Concept" },
  { value: "feedback", label: "Feedback" },
  { value: "credits", label: "Credits" },
  { value: "account", label: "Account" },
];

export function UserOperationsWorkbench({ search }: { search: AdminUsersSearch }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const stats = useQuery(api.adminUsers.getDirectoryStats);
  const directory = usePaginatedQuery(
    api.adminUsers.listDirectory,
    { search: query.trim() || undefined, filter: directoryFilter },
    { initialNumItems: 30 }
  );
  const selectedId = search.user as Id<"users"> | undefined;
  const activeTab = search.tab ?? "overview";
  const overview = useQuery(api.adminUsers.getOverview, selectedId ? { userId: selectedId } : "skip");
  const activity = useQuery(api.adminUsers.listActivity, selectedId && activeTab === "activity" ? { userId: selectedId, filter: activityFilter } : "skip");
  const ledger = useQuery(api.adminUsers.listCreditLedger, selectedId && activeTab === "credits" ? { userId: selectedId } : "skip");
  const feedback = useQuery(api.adminUsers.listFeedback, selectedId && activeTab === "feedback" ? { userId: selectedId } : "skip");
  const notes = useQuery(api.adminUsers.listNotes, selectedId ? { userId: selectedId } : "skip");
  const entitlementAccess = useQuery(api.adminUsers.getEntitlementAccess, selectedId && activeTab === "access" ? { userId: selectedId } : "skip");
  const addNote = useMutation(api.adminUsers.addNote);
  const grantCredits = useMutation(api.adminUsers.grantCredits);
  const grantEntitlements = useMutation(api.adminUsers.grantEntitlements);
  const revokeEntitlementGrant = useMutation(api.adminUsers.revokeEntitlementGrant);
  const updateUserAccess = useMutation(api.admin.updateUserAccess);
  const [noteDraft, setNoteDraft] = useState("");
  const [grantAmount, setGrantAmount] = useState("20");
  const [grantReason, setGrantReason] = useState("early-pilot-reward");
  const [grantNote, setGrantNote] = useState("");
  const [entitlementGrant, setEntitlementGrant] = useState<EntitlementGrantDraft>({
    sourceType: "manual",
    storageGb: "0",
    originalRetentionDays: "0",
    expiryDays: "30",
    originalDownloadAllowed: false,
    batchDownloadAllowed: false,
    note: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pendingAccessAction, setPendingAccessAction] = useState<AccessAction>(null);

  useEffect(() => {
    if (!search.user && directory.results[0]) {
      void navigate({
        to: "/admin/users",
        search: { user: directory.results[0]._id, tab: "overview" },
        replace: true,
      });
    }
  }, [directory.results, navigate, search.user]);

  useEffect(() => {
    setMessage(null);
    setNoteDraft("");
  }, [selectedId]);

  const shownCount = directory.results.length;

  function selectUser(userId: string) {
    void navigate({ to: "/admin/users", search: { user: userId, tab: "overview" } });
  }

  function selectTab(tab: UserTab) {
    void navigate({ to: "/admin/users", search: { user: search.user, tab }, replace: true });
  }

  async function submitNote() {
    if (!selectedId || !noteDraft.trim()) return;
    await runAction("note", async () => {
      await addNote({ userId: selectedId, body: noteDraft });
      setNoteDraft("");
    }, "Internal note added.");
  }

  async function submitGrant() {
    if (!selectedId) return;
    const amount = Number(grantAmount);
    await runAction("grant", async () => {
      await grantCredits({
        userId: selectedId,
        amount,
        reasonCode: grantReason,
        internalNote: grantNote.trim() || undefined,
      });
      setGrantNote("");
    }, `${amount} credits granted.`);
  }

  async function confirmAccessAction() {
    if (!selectedId || !overview || !pendingAccessAction) return;
    const action = pendingAccessAction;
    setPendingAccessAction(null);
    await runAction(`access-${action}`, async () => {
      if (action === "suspend" || action === "restore") {
        await updateUserAccess({ userId: selectedId, accountStatus: action === "suspend" ? "suspended" : "active" });
      } else {
        await updateUserAccess({ userId: selectedId, isAdmin: action === "grant-admin" });
      }
    }, accessActionSuccess(action));
  }

  async function submitEntitlementGrant() {
    if (!selectedId) return;
    const expiryDays = Number(entitlementGrant.expiryDays);
    await runAction("entitlement-grant", async () => {
      await grantEntitlements({
        userId: selectedId,
        sourceType: entitlementGrant.sourceType,
        storageGb: Number(entitlementGrant.storageGb),
        temporaryOriginalStorageGb: 0,
        pinnedOriginalStorageGb: 0,
        originalRetentionDays: Number(entitlementGrant.originalRetentionDays),
        versionRetentionDays: 0,
        masterMaxDimensionPx: 0,
        exportMaxDimensionPx: 0,
        originalPermanentStorage: false,
        originalDownloadAllowed: entitlementGrant.originalDownloadAllowed,
        originalPinAllowed: false,
        batchDownloadAllowed: entitlementGrant.batchDownloadAllowed,
        expiresAt: expiryDays > 0 ? Date.now() + expiryDays * 24 * 60 * 60 * 1000 : undefined,
        note: entitlementGrant.note.trim() || undefined,
      });
      setEntitlementGrant((current) => ({ ...current, note: "" }));
    }, "Entitlement grant issued.");
  }

  async function revokeGrant(grantId: Id<"accountEntitlementGrants">) {
    await runAction("entitlement-revoke", () => revokeEntitlementGrant({ grantId }), "Entitlement grant revoked.");
  }

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The operation could not be completed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="user-operations">
      <header className="user-operations__hero">
        <div>
          <p>Users</p>
          <h2>Account operations, activity, credits and access.</h2>
        </div>
        <dl className="user-operations__metrics">
          <Metric label="Total" value={stats?.total} />
          <Metric label="Active 30d" value={stats?.active} />
          <Metric label="Pro" value={stats?.pro} />
          <Metric label="Suspended" value={stats?.suspended} />
        </dl>
      </header>

      <div className="user-operations__workbench">
        <section className="user-directory" aria-labelledby="user-directory-title">
          <header className="user-pane-title">
            <h3 id="user-directory-title">User directory</h3>
            <span>{shownCount} shown</span>
          </header>
          <div className="user-directory__controls">
            <label className="user-directory__search">
              <MagnifyingGlassIcon aria-hidden="true" />
              <span className="sr-only">Search users</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
            </label>
            <div className="user-segmented" aria-label="Filter users">
              {directoryFilters.map((filter) => (
                <button className={cn(directoryFilter === filter.value && "is-active")} key={filter.value} onClick={() => setDirectoryFilter(filter.value)} type="button">
                  {filter.label}{filter.value === "flagged" && stats?.flagged ? ` ${stats.flagged}` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="user-directory__list">
            {directory.status === "LoadingFirstPage" ? (
              <PaneState icon={<ReloadIcon />} label="Loading user directory" />
            ) : directory.results.length === 0 ? (
              <PaneState label="No users match this view" />
            ) : (
              directory.results.map((user) => (
                <button
                  aria-pressed={selectedId === user._id}
                  className={cn("user-directory-row", selectedId === user._id && "is-active")}
                  key={user._id}
                  onClick={() => selectUser(user._id)}
                  type="button"
                >
                  <span className={cn("user-presence", user.accountStatus !== "active" && "is-inactive", user.hasOpenFlag && "is-flagged")} aria-hidden="true" />
                  <span className="user-directory-row__identity">
                    <strong>{user.fullName}</strong>
                    <small>@{user.handle}</small>
                    <time dateTime={new Date(user.lastActiveAt).toISOString()}>{user.accountStatus === "active" ? `Active ${relativeTime(user.lastActiveAt)}` : formatWords(user.accountStatus)}</time>
                  </span>
                  <span className="user-directory-row__plan">{user.planType}</span>
                  <ChevronRightIcon aria-hidden="true" />
                </button>
              ))
            )}
            {directory.status === "CanLoadMore" ? (
              <button className="user-directory__load" onClick={() => directory.loadMore(30)} type="button">Load more users</button>
            ) : null}
          </div>
        </section>

        <section className="user-inspector" aria-labelledby="user-inspector-title">
          <header className="user-pane-title">
            <h3 id="user-inspector-title">User inspector</h3>
            {overview ? <span>@{overview.user.handle}</span> : null}
          </header>
          {!selectedId ? (
            <PaneState icon={<PersonIcon />} label="Select a user to inspect" />
          ) : overview === undefined ? (
            <PaneState icon={<ReloadIcon />} label="Loading user record" />
          ) : overview === null ? (
            <PaneState icon={<CrossCircledIcon />} label="User record not found" />
          ) : (
            <div className="user-inspector__scroll">
              <InspectorIdentity overview={overview} />
              <nav className="user-inspector__tabs" aria-label="User inspector views">
                {tabs.map((tab) => (
                  <button aria-current={activeTab === tab.value ? "page" : undefined} className={cn(activeTab === tab.value && "is-active")} key={tab.value} onClick={() => selectTab(tab.value)} type="button">
                    {tab.label}
                  </button>
                ))}
              </nav>
              {message ? <p className={cn("user-operation-message", `is-${message.tone}`)}>{message.text}</p> : null}
              {activeTab === "overview" ? <OverviewTab overview={overview} notes={notes} noteDraft={noteDraft} setNoteDraft={setNoteDraft} onAddNote={() => { void submitNote(); }} busy={busy === "note"} onSelectTab={selectTab} /> : null}
              {activeTab === "activity" ? <ActivityTab items={activity} filter={activityFilter} setFilter={setActivityFilter} /> : null}
              {activeTab === "credits" ? <CreditsTab ledger={ledger} amount={grantAmount} setAmount={setGrantAmount} reason={grantReason} setReason={setGrantReason} note={grantNote} setNote={setGrantNote} onGrant={() => { void submitGrant(); }} busy={busy === "grant"} /> : null}
              {activeTab === "feedback" ? <FeedbackTab reports={feedback} /> : null}
              {activeTab === "access" ? <AccessTab overview={overview} entitlements={entitlementAccess ?? undefined} grant={entitlementGrant} setGrant={setEntitlementGrant} busy={busy} onGrant={() => { void submitEntitlementGrant(); }} onRevoke={(grantId) => { void revokeGrant(grantId); }} onUpdate={async (patch: AccessPatch, success: string) => runAction("access-update", () => updateUserAccess({ userId: selectedId, ...patch }), success)} onConfirm={setPendingAccessAction} /> : null}
            </div>
          )}
        </section>
      </div>

      <AccessConfirmation action={pendingAccessAction} open={pendingAccessAction !== null} onOpenChange={(open) => { if (!open) setPendingAccessAction(null); }} onConfirm={() => { void confirmAccessAction(); }} />
    </main>
  );
}

function InspectorIdentity({ overview }: { overview: OverviewData }) {
  return (
    <header className="user-inspector__identity">
      <div>
        <h3>{overview.user.fullName}</h3>
        <p>@{overview.user.handle} · {overview.user.email}</p>
        <small>Joined {formatDate(overview.user._creationTime)} · Last active {relativeTime(overview.user.lastActiveAt)}</small>
      </div>
      <div className="user-inspector__states">
        <StatusText value={overview.user.accountStatus} />
        <span>{overview.user.planType}</span>
      </div>
    </header>
  );
}

function OverviewTab({ overview, notes, noteDraft, setNoteDraft, onAddNote, busy, onSelectTab }: { overview: OverviewData; notes: NotesData | undefined; noteDraft: string; setNoteDraft: (value: string) => void; onAddNote: () => void; busy: boolean; onSelectTab: (tab: UserTab) => void }) {
  const metrics: Array<[string, number]> = [
    ["Credits", overview.metrics.credits], ["Concepts", overview.metrics.concepts], ["Generations", overview.metrics.generations],
    ["Feedback", overview.metrics.feedback], ["Saved", overview.metrics.saved], ["Flags", overview.metrics.flags],
  ];
  return (
    <div className="user-tab user-overview-tab">
      <dl className="user-overview-metrics">
        {metrics.map(([label, value]) => <div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}
      </dl>
      <section className="user-inspector-section">
        <SectionHead title="Recent activity" action={<button onClick={() => onSelectTab("activity")} type="button">View timeline <ChevronRightIcon /></button>} />
        <ActivityRows items={overview.recentActivity} compact />
      </section>
      <section className="user-inspector-section">
        <SectionHead title="Credit summary" action={<button onClick={() => onSelectTab("credits")} type="button">View ledger <ChevronRightIcon /></button>} />
        <dl className="credit-summary">
          <SummaryRow label="Balance" value={overview.creditSummary.balance} />
          <SummaryRow label="Granted" value={overview.creditSummary.granted} />
          <SummaryRow label="Purchased" value={overview.creditSummary.purchased} />
          <SummaryRow label="Promotional" value={overview.creditSummary.promotional} />
          <SummaryRow label="Spent" value={overview.creditSummary.spent} />
        </dl>
        {overview.creditSummary.lastTransaction ? <p className="credit-last-event"><span>Last transaction</span><strong>{signedNumber(overview.creditSummary.lastTransaction.delta)} · {overview.creditSummary.lastTransaction.description}</strong><time>{formatDateTime(overview.creditSummary.lastTransaction._creationTime)}</time></p> : null}
      </section>
      <AdminNotes notes={notes} draft={noteDraft} setDraft={setNoteDraft} onAdd={onAddNote} busy={busy} />
    </div>
  );
}

function ActivityTab({ items, filter, setFilter }: { items: ActivityData | undefined; filter: ActivityFilter; setFilter: (filter: ActivityFilter) => void }) {
  return (
    <div className="user-tab">
      <div className="user-tab__toolbar">
        <h4>Activity</h4>
        <div className="user-segmented is-compact">
          {activityFilters.map((item) => <button className={cn(filter === item.value && "is-active")} key={item.value} onClick={() => setFilter(item.value)} type="button">{item.label}</button>)}
        </div>
      </div>
      {items === undefined ? <PaneState icon={<ReloadIcon />} label="Loading activity" /> : <ActivityTimeline items={items} />}
    </div>
  );
}

function CreditsTab({ ledger, amount, setAmount, reason, setReason, note, setNote, onGrant, busy }: { ledger: LedgerData | undefined; amount: string; setAmount: (value: string) => void; reason: string; setReason: (value: string) => void; note: string; setNote: (value: string) => void; onGrant: () => void; busy: boolean }) {
  return (
    <div className="user-tab user-credits-tab">
      <section className="credit-ledger">
        <div className="credit-ledger__balance"><span>Credit ledger</span><strong>{ledger?.balance ?? "—"}</strong><small>Current balance</small></div>
        <div className="credit-ledger__table">
          <div className="credit-ledger__head"><span>Date</span><span>Type</span><span>Change</span><span>Balance</span></div>
          {ledger === undefined ? <PaneState icon={<ReloadIcon />} label="Loading credit ledger" /> : ledger.transactions.length === 0 ? <PaneState label="No credit transactions" /> : ledger.transactions.map((transaction) => (
            <div className="credit-ledger__row" key={transaction._id}>
              <time>{formatShortDate(transaction._creationTime)}</time>
              <span><strong>{formatWords(transaction.sourceType)}</strong><small>{transaction.description}</small></span>
              <b className={transaction.delta > 0 ? "is-positive" : "is-negative"}>{signedNumber(transaction.delta)}</b>
              <span>{transaction.balanceAfter}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="user-inspector-section grant-credits-form">
        <SectionHead title="Grant credits" />
        <div className="grant-credits-form__fields">
          <label><span>Amount</span><input inputMode="numeric" min="1" max="10000" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" /></label>
          <label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="early-pilot-reward">Early pilot reward</option><option value="service-recovery">Service recovery</option><option value="research-participant">Research participant</option><option value="manual-adjustment">Manual adjustment</option></select></label>
          <label className="is-wide"><span>Internal note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is this grant being made?" /></label>
        </div>
        <div className="grant-credits-form__footer"><span>Expires: Never</span><button disabled={busy || !Number.isInteger(Number(amount)) || Number(amount) < 1} onClick={onGrant} type="button"><PlusIcon />{busy ? "Granting" : `Grant ${amount || 0} credits`}</button></div>
      </section>
    </div>
  );
}

function FeedbackTab({ reports }: { reports: FeedbackData | undefined }) {
  const counts = useMemo(() => ({ open: reports?.filter((item) => item.status === "open" || item.status === "reviewing").length ?? 0, resolved: reports?.filter((item) => item.status === "resolved").length ?? 0 }), [reports]);
  return (
    <div className="user-tab">
      <div className="user-tab__summary"><strong>{reports?.length ?? 0} submitted</strong><span>{counts.open} open</span><span>{counts.resolved} resolved</span></div>
      <section className="user-feedback-list">
        {reports === undefined ? <PaneState icon={<ReloadIcon />} label="Loading feedback index" /> : reports.length === 0 ? <PaneState label="This user has not submitted feedback" /> : reports.map((report) => (
          <article key={report._id}>
            <div><strong>{feedbackReference(report)}</strong><span>{formatWords(report.category)}</span><StatusText value={report.status} /></div>
            <p>{report.title}</p>
            <footer><time>{formatDate(report._creationTime)}</time><Link to="/admin/feedback" search={{ report: report._id }}>Open <ExternalLinkIcon /></Link></footer>
          </article>
        ))}
      </section>
    </div>
  );
}

function AccessTab({ overview, entitlements, grant, setGrant, busy, onGrant, onRevoke, onUpdate, onConfirm }: {
  overview: OverviewData;
  entitlements: EntitlementAccessData | undefined;
  grant: EntitlementGrantDraft;
  setGrant: (value: EntitlementGrantDraft) => void;
  busy: string | null;
  onGrant: () => void;
  onRevoke: (grantId: Id<"accountEntitlementGrants">) => void;
  onUpdate: (patch: AccessPatch, success: string) => Promise<unknown>;
  onConfirm: (action: Exclude<AccessAction, null>) => void;
}) {
  const user = overview.user;
  const effective = entitlements?.effective;
  const hasGrant = Number(grant.storageGb) > 0 || Number(grant.originalRetentionDays) > 0 || grant.originalDownloadAllowed || grant.batchDownloadAllowed;
  return (
    <div className="user-tab">
      <section className="access-panel">
        <SectionHead title="Access & account" />
        <AccessRow label="Plan" value={formatWords(user.planType)} action={<button disabled={busy === "access-update"} onClick={() => { void onUpdate({ planType: user.planType === "free" ? "pro" : "free" }, `Plan changed to ${user.planType === "free" ? "Pro" : "Free"}.`); }} type="button">Change</button>} />
        <AccessRow label="Account status" value={formatWords(user.accountStatus)} action={<button onClick={() => onConfirm(user.accountStatus === "active" ? "suspend" : "restore")} type="button">Manage</button>} />
        <AccessRow label="Role" value={user.isAdmin ? "Admin" : "User"} />
        <AccessRow label="Creator status" value={user.isFeaturedCreator ? "Featured" : user.isVerifiedCreator ? "Verified" : "Standard"} action={<button disabled={busy === "access-update"} onClick={() => { void onUpdate({ isFeaturedCreator: !user.isFeaturedCreator }, user.isFeaturedCreator ? "Creator feature removed." : "Creator featured."); }} type="button">{user.isFeaturedCreator ? "Unfeature" : "Feature"}</button>} />
        <AccessRow label="Verification" value={user.isVerifiedCreator ? "Verified" : "Unverified"} action={<button disabled={busy === "access-update"} onClick={() => { void onUpdate({ isVerifiedCreator: !user.isVerifiedCreator }, user.isVerifiedCreator ? "Verification removed." : "Creator verified."); }} type="button">{user.isVerifiedCreator ? "Remove" : "Verify"}</button>} />
        <AccessRow label="Environment" value="Production · Locked" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="access-more" type="button"><DotsHorizontalIcon /> More actions</button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-none border-line-primary bg-surface text-ink-primary">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">Account operations</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onConfirm(user.accountStatus === "active" ? "suspend" : "restore")}>{user.accountStatus === "active" ? "Suspend account" : "Restore account"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { void onUpdate({ isFeaturedCreator: !user.isFeaturedCreator }, "Creator status updated."); }}>{user.isFeaturedCreator ? "Remove creator feature" : "Feature creator"}</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-line-secondary" />
            <DropdownMenuItem className="text-accent-red focus:text-accent-red" onSelect={() => onConfirm(user.isAdmin ? "remove-admin" : "grant-admin")}>{user.isAdmin ? "Remove admin role" : "Grant admin role"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
      <section className="user-inspector-section entitlement-access">
        <SectionHead title="Effective entitlements" />
        {effective ? (
          <dl className="entitlement-access__summary">
            <div><dt>Profile</dt><dd>{formatWords(effective.planType)} · r{effective.profileRevision}</dd></div>
            <div><dt>Library</dt><dd>{formatBytes(effective.libraryQuotaBytes)}</dd></div>
            <div><dt>Original retention</dt><dd>{effective.originalPermanentStorage ? "Permanent" : `${effective.originalRetentionDays} days`}</dd></div>
            <div><dt>Master / Export</dt><dd>{effective.masterMaxDimensionPx}px / {effective.exportMaxDimensionPx}px</dd></div>
            <div><dt>Original download</dt><dd>{effective.originalDownloadAllowed ? "Allowed" : "Blocked"}</dd></div>
            <div><dt>Active grants</dt><dd>{effective.activeGrantIds.length}</dd></div>
          </dl>
        ) : <PaneState icon={<ReloadIcon />} label="Loading entitlements" />}
      </section>
      <section className="user-inspector-section grant-credits-form entitlement-grant-form">
        <SectionHead title="Grant entitlements" />
        <div className="grant-credits-form__fields">
          <label><span>Storage</span><input min="0" max="1000" step="0.01" value={grant.storageGb} onChange={(event) => setGrant({ ...grant, storageGb: event.target.value })} type="number" /></label>
          <label><span>Original retention</span><input min="0" max="3650" value={grant.originalRetentionDays} onChange={(event) => setGrant({ ...grant, originalRetentionDays: event.target.value })} type="number" /></label>
          <label><span>Expires after</span><input min="0" max="3650" value={grant.expiryDays} onChange={(event) => setGrant({ ...grant, expiryDays: event.target.value })} type="number" /></label>
          <label><span>Source</span><select value={grant.sourceType} onChange={(event) => setGrant({ ...grant, sourceType: event.target.value as EntitlementGrantDraft["sourceType"] })}><option value="manual">Manual grant</option><option value="promotion">Promotion</option><option value="early-adopter">Early adopter</option></select></label>
          <label className="entitlement-grant-check"><input checked={grant.originalDownloadAllowed} onChange={(event) => setGrant({ ...grant, originalDownloadAllowed: event.target.checked })} type="checkbox" /><span>Original download</span></label>
          <label className="entitlement-grant-check"><input checked={grant.batchDownloadAllowed} onChange={(event) => setGrant({ ...grant, batchDownloadAllowed: event.target.checked })} type="checkbox" /><span>Batch download</span></label>
          <label className="is-wide"><span>Internal note</span><textarea value={grant.note} onChange={(event) => setGrant({ ...grant, note: event.target.value })} placeholder="Reason for this temporary entitlement" /></label>
        </div>
        <div className="grant-credits-form__footer"><span>{Number(grant.expiryDays) > 0 ? `Expires in ${grant.expiryDays} days` : "No expiry"}</span><button disabled={busy === "entitlement-grant" || !hasGrant} onClick={onGrant} type="button"><PlusIcon />{busy === "entitlement-grant" ? "Granting" : "Issue grant"}</button></div>
      </section>
      <section className="user-inspector-section entitlement-history">
        <SectionHead title="Grant history" />
        {!entitlements ? <PaneState icon={<ReloadIcon />} label="Loading grant history" /> : entitlements.grants.length === 0 ? <p>No entitlement grants for this account.</p> : entitlements.grants.map((item) => (
          <div className="entitlement-history__row" key={item._id}>
            <div><strong>{formatWords(item.sourceType)}</strong><small>{describeEntitlementGrant(item)}</small></div>
            <span className={cn(item.active && "is-active")}>{item.active ? item.expiresAt ? `Until ${formatDate(item.expiresAt)}` : "Active" : item.revokedAt ? "Revoked" : "Expired"}</span>
            {item.active ? <button disabled={busy === "entitlement-revoke"} onClick={() => onRevoke(item._id)} type="button">Revoke</button> : <i />}
          </div>
        ))}
      </section>
    </div>
  );
}

function AdminNotes({ notes, draft, setDraft, onAdd, busy }: { notes: NotesData | undefined; draft: string; setDraft: (value: string) => void; onAdd: () => void; busy: boolean }) {
  return (
    <section className="user-inspector-section admin-notes">
      <SectionHead title="Admin notes" />
      <div className="admin-notes__list">
        {notes === undefined ? <p>Loading notes…</p> : notes.length === 0 ? <p>No internal notes for this user.</p> : notes.map((note) => <article key={note._id}><header><time>{formatDate(note.createdAt)}</time><span>@{note.author?.handle ?? "admin"}</span></header><p>{note.body}</p></article>)}
      </div>
      <label className="admin-notes__composer"><span className="sr-only">Add internal note</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add an internal note" /><button disabled={busy || draft.trim().length < 3} onClick={onAdd} type="button">{busy ? "Adding" : "Add note"}</button></label>
    </section>
  );
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <PaneState label="No meaningful activity in this view" />;
  let previousDay = "";
  return <div className="activity-timeline">{items.map((item) => { const day = dayLabel(item.occurredAt); const showDay = day !== previousDay; previousDay = day; return <div key={item.id}>{showDay ? <h5>{day}</h5> : null}<ActivityRow item={item} /></div>; })}</div>;
}

function ActivityRows({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  if (!items.length) return <PaneState label="No recent business activity" />;
  return <div className={cn("activity-rows", compact && "is-compact")}>{items.map((item) => <ActivityRow item={item} key={item.id} />)}</div>;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <article className="activity-row">
      <time>{formatTime(item.occurredAt)}</time>
      <div><span>{item.type}</span><strong>{item.summary}</strong><small>{item.detail}</small></div>
      <EntityLink entityType={item.entityType} entityId={item.entityId} />
    </article>
  );
}

function EntityLink({ entityType, entityId }: { entityType: string; entityId?: string }) {
  if (!entityId) return null;
  if (entityType === "generation") return <Link aria-label="Open generation" to="/admin/generations" search={{ run: entityId }}><ExternalLinkIcon /></Link>;
  if (entityType === "feedback") return <Link aria-label="Open feedback" to="/admin/feedback" search={{ report: entityId }}><ExternalLinkIcon /></Link>;
  if (entityType === "concept") return <Link aria-label="Open prototype" to="/prototype/$conceptId" params={{ conceptId: entityId }}><ExternalLinkIcon /></Link>;
  return null;
}

function AccessConfirmation({ action, open, onOpenChange, onConfirm }: { action: AccessAction; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const copy = action === "suspend" ? ["Suspend this account?", "The user will lose access until an administrator restores the account."] : action === "restore" ? ["Restore this account?", "The user will regain normal account access."] : action === "grant-admin" ? ["Grant administrator access?", "This user will be able to manage platform data and user accounts."] : ["Remove administrator access?", "The user will lose platform management access."];
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent className="rounded-none border-2 border-line-primary bg-panel text-ink-primary"><AlertDialogHeader><AlertDialogTitle>{copy[0]}</AlertDialogTitle><AlertDialogDescription className="text-ink-secondary">{copy[1]}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-none border-line-secondary bg-transparent">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-none bg-accent-red text-white hover:bg-accent-red/90" onClick={onConfirm}>Confirm change</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function SectionHead({ title, action }: { title: string; action?: ReactNode }) { return <header className="user-section-head"><h4>{title}</h4>{action}</header>; }
function AccessRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) { return <div className="access-row"><span>{label}</span><strong>{value}</strong>{action ?? <i />}</div>; }
function SummaryRow({ label, value }: { label: string; value: number }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Metric({ label, value }: { label: string; value?: number }) { return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>; }
function PaneState({ icon, label }: { icon?: ReactNode; label: string }) { return <div className="user-pane-state">{icon}<p>{label}</p></div>; }
function StatusText({ value }: { value: string }) { return <span className={cn("user-status-text", `is-${value}`)}>{value === "resolved" ? <CheckCircledIcon /> : value === "rejected" || value === "suspended" ? <CrossCircledIcon /> : value === "reviewing" ? <ClockIcon /> : null}{formatWords(value)}</span>; }
function signedNumber(value: number) { return `${value > 0 ? "+" : ""}${value}`; }
function formatWords(value: string) { return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function formatDate(value: number) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value); }
function formatShortDate(value: number) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value); }
function formatDateTime(value: number) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value); }
function formatTime(value: number) { return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value); }
function dayLabel(value: number) { const date = new Date(value); const now = new Date(); if (date.toDateString() === now.toDateString()) return "Today"; const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1); if (date.toDateString() === yesterday.toDateString()) return "Yesterday"; return formatDate(value); }
function relativeTime(value: number) { const seconds = Math.max(1, Math.floor((Date.now() - value) / 1000)); if (seconds < 60) return "just now"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days < 30 ? `${days}d ago` : formatShortDate(value); }
function feedbackReference(report: { recordNumber?: number; _id: string }) { return report.recordNumber ? `FB-${String(report.recordNumber).padStart(4, "0")}` : `FB-${report._id.slice(-4).toUpperCase()}`; }
function formatBytes(value: number) { return value >= 1024 ** 3 ? `${Math.round((value / 1024 ** 3) * 100) / 100} GB` : `${Math.round(value / 1024 ** 2)} MB`; }
function describeEntitlementGrant(grant: EntitlementAccessData["grants"][number]) {
  const parts = [
    grant.libraryQuotaBytesDelta ? `+${formatBytes(grant.libraryQuotaBytesDelta)} library` : null,
    grant.originalRetentionDays ? `${grant.originalRetentionDays}d Original` : null,
    grant.originalDownloadAllowed ? "Original download" : null,
    grant.batchDownloadAllowed ? "Batch download" : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Capability grant";
}
function accessActionSuccess(action: Exclude<AccessAction, null>) { return action === "suspend" ? "Account suspended." : action === "restore" ? "Account restored." : action === "grant-admin" ? "Administrator access granted." : "Administrator access removed."; }
