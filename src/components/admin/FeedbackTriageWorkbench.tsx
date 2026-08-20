import {
  CheckIcon,
  ExternalLinkIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type FeedbackStatus = "open" | "reviewing" | "resolved" | "rejected";
type FeedbackPriority = "low" | "normal" | "high";
type RootCause =
  | "prompt"
  | "style-dna"
  | "material-preset"
  | "model-kit"
  | "generation-provider"
  | "user-configuration"
  | "unknown";
type ResolutionOutcome =
  | "fixed"
  | "planned"
  | "unable-to-reproduce"
  | "no-action"
  | "duplicate"
  | "unsupported";

type TriageDraft = {
  status: FeedbackStatus;
  priority: FeedbackPriority;
  rootCause: RootCause | "";
  resolutionOutcome: ResolutionOutcome | "";
  assigneeUserId: string;
  internalNote: string;
  userResponse: string;
  sendResponse: boolean;
  resolutionExperimentRunId: string;
};

const statusOptions: Array<{ value: FeedbackStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const rootCauseOptions: Array<{ value: RootCause; label: string }> = [
  { value: "prompt", label: "Prompt issue" },
  { value: "style-dna", label: "Style DNA issue" },
  { value: "material-preset", label: "Material preset issue" },
  { value: "model-kit", label: "Model / Kit issue" },
  { value: "generation-provider", label: "Generation provider issue" },
  { value: "user-configuration", label: "User configuration" },
  { value: "unknown", label: "Unknown" },
];

const outcomeOptions: Array<{ value: ResolutionOutcome; label: string }> = [
  { value: "fixed", label: "Fixed" },
  { value: "planned", label: "Planned" },
  { value: "unable-to-reproduce", label: "Unable to reproduce" },
  { value: "no-action", label: "No action required" },
  { value: "duplicate", label: "Duplicate" },
  { value: "unsupported", label: "Unsupported" },
];

export function FeedbackTriageWorkbench({ initialReportId }: { initialReportId?: string }) {
  const navigate = useNavigate();
  const reports = useQuery(api.admin.listFeedbackPipeline);
  const users = useQuery(api.admin.listUsers, {});
  const experiments = useQuery(api.admin.listPromptExperimentRuns, {});
  const reviewFeedback = useMutation(api.admin.reviewFeedback);
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<"priority" | "newest" | "oldest">("priority");
  const [draft, setDraft] = useState<TriageDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const priorityWeight = { high: 0, normal: 1, low: 2 } as const;
    return [...(reports ?? [])]
      .filter((report) => {
        if (statusFilter !== "all" && report.status !== statusFilter) return false;
        if (categoryFilter !== "all" && report.category !== categoryFilter) return false;
        if (!normalizedSearch) return true;
        return [
          report.title,
          report.message,
          report.reporter?.handle,
          report.reporter?.email,
          report.kitVariant?.name,
          formatReference(report.recordNumber, report._id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sort === "newest") return b._creationTime - a._creationTime;
        if (sort === "oldest") return a._creationTime - b._creationTime;
        return priorityWeight[a.priority] - priorityWeight[b.priority] || b._creationTime - a._creationTime;
      });
  }, [categoryFilter, reports, search, sort, statusFilter]);

  const selected = reports?.find((report) => report._id === selectedId) ?? filteredReports[0] ?? null;
  const admins = users?.filter((user) => user.canManagePlatform) ?? [];
  const counts = useMemo(() => {
    const all = reports ?? [];
    return {
      open: all.filter((report) => report.status === "open").length,
      reviewing: all.filter((report) => report.status === "reviewing").length,
      resolved: all.filter((report) => report.status === "resolved").length,
      rejected: all.filter((report) => report.status === "rejected").length,
    };
  }, [reports]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setSelectedId(selected._id);
    setDraft({
      status: selected.status,
      priority: selected.priority,
      rootCause: selected.rootCause ?? "",
      resolutionOutcome: selected.resolutionOutcome ?? "",
      assigneeUserId: selected.assignee?._id ?? "",
      internalNote: selected.internalNote ?? "",
      userResponse: selected.userResponseDraft ?? "",
      sendResponse: false,
      resolutionExperimentRunId: selected.resolutionExperiment?._id ?? "",
    });
    setMessage(null);
  }, [selected?._id]);

  useEffect(() => {
    if (initialReportId) setSelectedId(initialReportId);
  }, [initialReportId]);

  async function save(nextStatus?: FeedbackStatus) {
    if (!selected || !draft) return;
    const status = nextStatus ?? draft.status;
    setBusy(true);
    setMessage(null);
    try {
      await reviewFeedback({
        feedbackId: selected._id,
        status,
        priority: draft.priority,
        rootCause: draft.rootCause || undefined,
        resolutionOutcome: draft.resolutionOutcome || undefined,
        assigneeUserId: draft.assigneeUserId
          ? draft.assigneeUserId as Id<"users">
          : undefined,
        internalNote: draft.internalNote.trim() || undefined,
        userResponse: draft.userResponse.trim() || undefined,
        sendResponse: draft.sendResponse,
        resolutionExperimentRunId: draft.resolutionExperimentRunId
          ? draft.resolutionExperimentRunId as Id<"promptExperimentRuns">
          : undefined,
      });
      setDraft((current) => current ? { ...current, status, sendResponse: false } : current);
      setMessage({ tone: "success", text: status === "resolved" ? "Report resolved." : "Triage changes saved." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "The report could not be updated.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="feedback-triage">
      <header className="feedback-triage__hero">
        <div>
          <p>Feedback triage</p>
          <h2>Review user reports and route product signals.</h2>
        </div>
        <dl className="feedback-triage__metrics">
          {statusOptions.map((status) => (
            <div key={status.value}>
              <dt><StatusMark status={status.value} />{status.label}</dt>
              <dd>{counts[status.value]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="feedback-triage__workbench">
        <section className="feedback-queue" aria-labelledby="feedback-queue-title">
          <header className="feedback-pane-title">
            <h3 id="feedback-queue-title">Report queue</h3>
            <span>{filteredReports.length} shown</span>
          </header>
          <div className="feedback-queue__controls">
            <label className="feedback-queue__search">
              <MagnifyingGlassIcon aria-hidden="true" />
              <span className="sr-only">Search reports</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" />
            </label>
            <div className="feedback-queue__filters">
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | "all")}>
                <option value="all">All status</option>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                <option value="generation-quality">Generation quality</option>
                <option value="missing-base-model">Missing kit</option>
                <option value="style-request">Style request</option>
                <option value="paint-mapping">Paint mapping</option>
                <option value="other">Other</option>
              </select>
              <select aria-label="Sort reports" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          <div className="feedback-queue__list">
            {reports === undefined ? (
              <QueueState icon={<ReloadIcon />} title="Loading report queue" />
            ) : filteredReports.length === 0 ? (
              <QueueState title="No reports match these filters" />
            ) : filteredReports.map((report) => (
              <button
                aria-pressed={selected?._id === report._id}
                className={cn("feedback-queue-row", selected?._id === report._id && "is-active")}
                key={report._id}
                onClick={() => {
                  setSelectedId(report._id);
                  void navigate({ to: "/admin/feedback", search: { report: report._id }, replace: true });
                }}
                type="button"
              >
                <div className="feedback-queue-row__top">
                  <strong><StatusMark status={report.status} />{formatReference(report.recordNumber, report._id)}</strong>
                  <time dateTime={new Date(report._creationTime).toISOString()}>{relativeTime(report._creationTime)}</time>
                </div>
                <span className="feedback-queue-row__category">{formatCategory(report.category)}</span>
                <b>{report.title}</b>
                <small>@{report.reporter?.handle ?? "unknown"}{report.concept ? ` · ${report.concept.title}` : ""}</small>
                {report.priority === "high" ? <em>High priority</em> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="feedback-inspector" aria-labelledby="feedback-inspector-title">
          <header className="feedback-pane-title">
            <h3 id="feedback-inspector-title">Report inspector</h3>
            {selected ? <span>{formatReference(selected.recordNumber, selected._id)}</span> : null}
          </header>
          {!selected || !draft ? (
            <QueueState title="Select a report to inspect" />
          ) : (
            <div className="feedback-inspector__scroll">
              <article className="feedback-inspector__summary">
                <div className="feedback-inspector__reference">
                  <strong>{formatReference(selected.recordNumber, selected._id)}</strong>
                  <StatusLabel status={selected.status} />
                </div>
                <p>{formatCategory(selected.category)}</p>
                <h3>{selected.title}</h3>
                <div className="feedback-inspector__byline">
                  <span>Submitted by <b>@{selected.reporter?.handle ?? "unknown"}</b></span>
                  <time dateTime={new Date(selected._creationTime).toISOString()}>{formatDateTime(selected._creationTime)}</time>
                </div>
              </article>

              <InspectorSection title="Report">
                <p className="feedback-inspector__report-copy">{selected.message}</p>
                {selected.attachment ? (
                  <a className="feedback-inspector__attachment" href={selected.attachment.publicUrl} rel="noreferrer" target="_blank">
                    <img alt="User-submitted report attachment" src={selected.attachment.publicUrl} />
                    <span>Open attachment <ExternalLinkIcon /></span>
                  </a>
                ) : null}
              </InspectorSection>

              <InspectorSection title="Attached context">
                <dl className="feedback-context-list">
                  <ContextRow label="Source" value={formatSource(selected.source)} href={selected.sourcePage} />
                  <ContextRow label="Prototype" value={selected.concept ? `${formatPrototypeReference(selected.concept.recordNumber)} · ${selected.concept.title}` : "Not attached"} href={selected.concept ? `/prototype/${selected.concept._id}` : undefined} />
                  <ContextRow label="Kit variant" value={selected.kitVariant?.name ?? "Not specified"} />
                  <ContextRow label="Style DNA" value={selected.stylePreset?.name ?? "Not specified"} href={selected.stylePreset ? "/admin/styles" : undefined} />
                  <ContextRow label="Material" value={selected.materialPreset?.name ?? "Not specified"} href={selected.materialPreset ? "/admin/materials" : undefined} />
                  <ContextRow label="Generation" value={selected.generationJob ? `${shortId(selected.generationJob._id)} · ${selected.generationJob.provider ?? "provider pending"}` : "Not attached"} href={selected.generationJob ? `/admin/generations?job=${selected.generationJob._id}` : undefined} />
                </dl>
              </InspectorSection>

              <InspectorSection title="Triage">
                <div className="feedback-triage-form">
                  <SelectField label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as FeedbackStatus })}>
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectField>
                  <SelectField label="Priority" value={draft.priority} onChange={(value) => setDraft({ ...draft, priority: value as FeedbackPriority })}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                  </SelectField>
                  <SelectField label="Root cause" value={draft.rootCause} onChange={(value) => setDraft({ ...draft, rootCause: value as RootCause | "" })}>
                    <option value="">Unclassified</option>
                    {rootCauseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectField>
                  <SelectField label="Outcome" value={draft.resolutionOutcome} onChange={(value) => setDraft({ ...draft, resolutionOutcome: value as ResolutionOutcome | "" })}>
                    <option value="">No conclusion</option>
                    {outcomeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectField>
                  <SelectField label="Assignee" value={draft.assigneeUserId} onChange={(value) => setDraft({ ...draft, assigneeUserId: value })}>
                    <option value="">Unassigned</option>
                    {admins.map((admin) => <option key={admin._id} value={admin._id}>@{admin.handle}</option>)}
                  </SelectField>
                </div>
                <label className="feedback-text-field">
                  <span>Internal note <em>Admin only</em></span>
                  <textarea value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} placeholder="Record diagnosis, reproduction details, or follow-up work." />
                </label>
              </InspectorSection>

              <InspectorSection title="Resolution">
                <QuickActions report={selected} />
                <label className="feedback-text-field feedback-resolution-run">
                  <span>Validated experiment <em>Prompt Lab evidence</em></span>
                  <select value={draft.resolutionExperimentRunId} onChange={(event) => setDraft({ ...draft, resolutionExperimentRunId: event.target.value })}>
                    <option value="">No experiment attached</option>
                    {(experiments ?? []).map((experiment) => (
                      <option key={experiment._id} value={experiment._id}>
                        {experiment.templateName} · {experiment.templateVersion} · {shortId(experiment._id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="feedback-text-field">
                  <span>User response <em>Visible to reporter</em></span>
                  <textarea value={draft.userResponse} onChange={(event) => setDraft({ ...draft, userResponse: event.target.value })} placeholder="Explain the conclusion and what changed." />
                </label>
                <label className="feedback-send-response">
                  <input checked={draft.sendResponse} onChange={(event) => setDraft({ ...draft, sendResponse: event.target.checked })} type="checkbox" />
                  <span>Publish this response to My Reports</span>
                </label>
                {message ? <p className={`feedback-triage-message is-${message.tone}`} role="status">{message.text}</p> : null}
                <div className="feedback-resolution-actions">
                  <button disabled={busy} onClick={() => void save()} type="button">{busy ? "Saving" : "Save triage"}</button>
                  <button className="is-primary" disabled={busy} onClick={() => void save(draft.status === "rejected" ? "rejected" : "resolved")} type="button">
                    <CheckIcon /> {draft.status === "rejected" ? "Reject report" : "Resolve report"}
                  </button>
                </div>
              </InspectorSection>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InspectorSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="feedback-inspector-section"><h4>{title}</h4>{children}</section>;
}

function SelectField({ children, label, onChange, value }: { children: React.ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function ContextRow({ href, label, value }: { href?: string; label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{href ? <a href={href}>{value}<ExternalLinkIcon /></a> : value}</dd></div>;
}

function QuickActions({ report }: { report: { _id: string; category: string; concept: { _id: string } | null; generationJob: { _id: string } | null } }) {
  const actions = report.category === "generation-quality"
    ? [
        { href: report.generationJob ? `/admin/generations?job=${report.generationJob._id}` : "/admin/generations", label: "Open generation run" },
        { href: `/admin/prompt-lab?feedback=${report._id}${report.concept ? `&concept=${report.concept._id}` : ""}`, label: "Send to Prompt Lab" },
      ]
    : report.category === "missing-base-model"
      ? [{ href: "/admin/models", label: "Open models admin" }]
      : report.category === "style-request"
        ? [{ href: "/admin/styles", label: "Open Style DNA" }]
        : report.category === "paint-mapping"
          ? [{ href: "/admin/paints", label: "Open paint mapping" }, { href: "/admin/materials", label: "Open material" }]
          : [];
  if (!actions.length) return null;
  return <div className="feedback-quick-actions">{actions.map((action) => <a href={action.href} key={action.href}>{action.label}<ExternalLinkIcon /></a>)}</div>;
}

function QueueState({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return <div className="feedback-queue-state">{icon}<p>{title}</p></div>;
}

function StatusMark({ status }: { status: FeedbackStatus }) {
  return <i aria-hidden="true" className={`feedback-status-mark is-${status}`}>{status === "resolved" ? "✓" : status === "rejected" ? "×" : status === "reviewing" ? "◐" : "●"}</i>;
}

function StatusLabel({ status }: { status: FeedbackStatus }) {
  return <span className={`feedback-inspector-status is-${status}`}><StatusMark status={status} />{status}</span>;
}

function formatReference(recordNumber?: number, id?: string) {
  return recordNumber ? `FB-${String(recordNumber).padStart(4, "0")}` : `FB-${id?.slice(-4).toUpperCase() ?? "----"}`;
}

function formatPrototypeReference(recordNumber?: number) {
  return recordNumber ? `N°.${String(recordNumber).padStart(3, "0")}` : "Prototype";
}

function shortId(id: string) { return `R-${id.slice(-4).toUpperCase()}`; }
function formatCategory(category: string) { return ({ "generation-quality": "Generation quality", "missing-base-model": "Missing kit", "style-request": "Style request", "paint-mapping": "Paint mapping", other: "Other" } as Record<string, string>)[category] ?? category; }
function formatSource(source: string) { return ({ prototype: "Prototype page", "generation-result": "Generation result", standalone: "Standalone feedback", showcase: "Showcase", library: "Library" } as Record<string, string>)[source] ?? source; }
function formatDateTime(timestamp: number) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)); }
function relativeTime(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
