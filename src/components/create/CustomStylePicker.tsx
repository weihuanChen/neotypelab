import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { StyleIntent } from "@/convex/creativeContracts";
import type { DirectionMatch, InterpretationResult } from "@/convex/styleInterpretations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JobResult, JobWait, jobWaitProfiles, type StyleJobPhase } from "@/src/components/job-wait";
import { resolveStyleJobPhase } from "./styleJobPhase";

type Props = {
  userId: string;
  creditCost?: number;
  creditBalance?: number;
  selectedId: Id<"userStyles"> | null;
  onUse: (intent: StyleIntent, styleId: Id<"userStyles">) => void;
  onClear: () => void;
  view: "describe" | "mine";
  onApply: () => void;
  onPhaseChange?: (phase: StyleJobPhase) => void;
};

export function CustomStylePicker({
  userId,
  creditCost,
  creditBalance,
  selectedId,
  onUse,
  onClear,
  view: tab,
  onApply,
  onPhaseChange,
}: Props) {
  const [description, setDescription] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [savedResult, setSavedResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formingStartedAt, setFormingStartedAt] = useState<number | null>(null);
  const [acceptedExisting, setAcceptedExisting] = useState(false);
  const storageKey = "neotypelab.style-draft:" + userId;
  const interpret = useAction(api.prototypeTools.interpretCustomStyle);
  const save = useMutation(api.userStyles.saveInterpretation);
  const setVisibility = useMutation(api.userStyles.setVisibility);
  const mine = useQuery(api.userStyles.mine);
  const match = useQuery(api.styleInterpretations.matchDirection, queryDescription ? { description: queryDescription } : "skip");
  const attempt = useQuery(api.styleInterpretations.requestState, requestKey ? { requestKey } : "skip");
  const recovered = match?.interpretation?.sourceDescription === queryDescription ? match.interpretation : null;
  const checkingHistory = Boolean(description.trim()) && (description.trim() !== queryDescription || (Boolean(queryDescription) && match === undefined) || (requestKey !== null && attempt === undefined));
  const interpretation = adjusting ? null : result?.sourceDescription === description.trim() ? result
    : acceptedExisting && recovered?.sourceDescription === description.trim() ? recovered : null;
  const phase = resolveStyleJobPhase({
    acceptedExisting,
    adjusting,
    busy,
    error,
    hasDirectionMatch: Boolean(recovered),
    hasSavedStyle: Boolean(acceptedExisting && match?.style),
    interpretation,
    savedCompositionId: savedResult,
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as { description?: unknown; requestKey?: unknown } | null;
      if (typeof saved?.description === "string" && saved.description.length <= 2000) setDescription(saved.description);
      if (typeof saved?.requestKey === "string") setRequestKey(saved.requestKey);
    } catch { /* A blocked browser storage does not prevent creation. */ }
  }, [storageKey]);
  useEffect(() => {
    const timer = setTimeout(() => setQueryDescription(description.trim()), 300);
    return () => clearTimeout(timer);
  }, [description]);
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  const interpretationUnavailable = creditCost === undefined;
  const insufficientCredits = creditCost !== undefined && creditBalance !== undefined && creditBalance < creditCost;

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await task(); } catch (cause) { setError(convexErrorText(cause)); }
    finally { setBusy(false); }
  }

  async function onInterpret(forceNew = false) {
    onClear();
    const key = !forceNew && requestKey && attempt?.status !== "failed" ? requestKey : crypto.randomUUID();
    setRequestKey(key);
    setAcceptedExisting(false);
    setFormingStartedAt(Date.now());
    try { sessionStorage.setItem(storageKey, JSON.stringify({ description, requestKey: key })); } catch { /* Optional recovery storage. */ }
    const response = await interpret({ description, requestKey: key });
    setResult(response); setAdjusting(false); setSavedResult(null);
  }

  function persistDraft(nextDescription: string, nextKey: string | null, syncQuery = false) {
    setDescription(nextDescription);
    setRequestKey(nextKey);
    setResult(null);
    setError("");
    setAcceptedExisting(false);
    if (syncQuery) setQueryDescription(nextDescription.trim());
    onClear();
    try {
      if (!nextDescription.trim()) sessionStorage.removeItem(storageKey);
      else if (nextKey) sessionStorage.setItem(storageKey, JSON.stringify({ description: nextDescription, requestKey: nextKey }));
    } catch { /* Optional recovery storage. */ }
  }

  function reviseDirection() {
    setAdjusting(true);
    setAcceptedExisting(false);
    setSavedResult(null);
    setError("");
    setFormingStartedAt(null);
    onClear();
  }

  function newStyle() {
    setAdjusting(false);
    setAcceptedExisting(false);
    setSavedResult(null);
    setFormingStartedAt(null);
    persistDraft("", null, true);
  }

  function useExisting() {
    if (!recovered) return;
    setAcceptedExisting(true);
    setAdjusting(false);
    setError("");
    if (match?.style) {
      onUse(recovered.intent, match.style.id as Id<"userStyles">);
      setSavedResult(recovered.promptCompositionId);
    }
  }

  function submitDirection() {
    if (recovered && !acceptedExisting) {
      setAdjusting(false);
      return;
    }
    void run(() => onInterpret(false));
  }

  return <div className="custom-style-picker mt-6 space-y-6">
    {error && phase === "input" ? <p role="alert" className="workbench-notice">{error}</p> : null}
    {tab === "describe" && phase === "forming" ? (
      <JobWait profile={jobWaitProfiles.customStyle} startedAt={formingStartedAt ?? undefined} />
    ) : null}
    {tab === "describe" && phase === "interrupted" ? (
      <JobWait
        error={error}
        profile={jobWaitProfiles.customStyle}
        status="interrupted"
        primary={<button className="system-state__button" disabled={busy} onClick={() => { void run(() => onInterpret(true)); }} type="button">{busy ? "Retrying…" : "Retry"}</button>}
        secondary={<button className="system-state__link" disabled={busy} onClick={newStyle} type="button">New style</button>}
      />
    ) : null}
    {tab === "describe" && phase === "existing" && recovered && match ? (
      <StyleJobExisting
        busy={busy}
        creditBalance={creditBalance}
        creditCost={creditCost}
        direction={description}
        match={match}
        onFormAgain={() => { void run(() => onInterpret(true)); }}
        onRevise={reviseDirection}
        onUseExisting={useExisting}
      />
    ) : null}
    {tab === "describe" && interpretation && (phase === "review" || phase === "stored") ? (
      <StyleJobComplete
        busy={busy}
        direction={description}
        interpretation={interpretation}
        phase={phase}
        onApply={() => { void run(async () => {
          const saved = await save({ promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
          onUse(saved.intent, saved.styleId); setSavedResult(interpretation.promptCompositionId); onApply();
        }); }}
        onSave={() => { void run(async () => {
          const saved = await save({ promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
          onUse(saved.intent, saved.styleId); setSavedResult(interpretation.promptCompositionId);
        }); }}
        onNewStyle={newStyle}
        onRevise={reviseDirection}
      />
    ) : null}
    {tab === "describe" && phase === "input" ? <div className="style-command">
      <p className="style-command-kicker">Create a style</p>
      <h2>What should this kit become?</h2>
      <Textarea aria-label="Describe your repaint idea" value={description} maxLength={2000} disabled={busy}
        placeholder="Describe a color scheme, character, era, design language, or mood…"
        onChange={event => {
          persistDraft(event.target.value, null);
          setAdjusting(false);
        }} />
      <div className="style-command-examples">{["Crimson armor with restrained gold accents", "Cyan idol colors with racing graphics", "Cold-war naval aviation"].map(example =>
        <button type="button" key={example} disabled={busy} onClick={() => { persistDraft(example, null, true); setAdjusting(false); }}>“{example}”</button>)}</div>
      <Button disabled={busy || checkingHistory || !description.trim() || (!recovered && (interpretationUnavailable || insufficientCredits))} onClick={submitDirection}>
        {checkingHistory ? "Checking previous direction…" : "Form style →"}
      </Button>
      <p className="style-command-cost">{costCopy(creditCost, creditBalance)}</p>
    </div> : null}
    {tab === "mine" ? <div className="space-y-5">
      <p>Styles are private until you publish them. Making a style private stops new saves; existing private copies remain.</p>
      {mine === undefined ? <p>Loading your styles…</p> : mine.length === 0 ? <p>No saved styles yet. Form a direction to create your first.</p> : mine.map(style =>
        <article className="workbench-notice space-y-3" key={style.id}>
          <div><strong>{style.name}</strong><p>{style.status === "hidden" ? "Unavailable" : style.visibility === "community" ? "Community" : "Private"}{style.sourceStyleId ? " · Saved from community" : ""}</p></div>
          <IntentSummary intent={style.intent} />
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy || style.status !== "active"} onClick={() => onUse(style.intent, style.id)}>{selectedId === style.id ? "Selected" : "Use this style"}</Button>
            {!style.sourceStyleId && style.status === "active" ? <Button variant="outline" disabled={busy} onClick={() => { void run(async () => {
              await setVisibility({ styleId: style.id, visibility: style.visibility === "private" ? "community" : "private" });
            }); }}>{style.visibility === "private" ? "Publish to Community" : "Make private"}</Button> : null}
            {style.visibility === "community" && style.status === "active" ? <a href={`/c/${style.id}`}>Open style →</a> : null}
          </div>
        </article>)}
    </div> : null}

  </div>;
}

function StyleJobExisting({
  busy,
  creditBalance,
  creditCost,
  direction,
  match,
  onFormAgain,
  onRevise,
  onUseExisting,
}: {
  busy: boolean;
  creditBalance?: number;
  creditCost?: number;
  direction: string;
  match: DirectionMatch;
  onFormAgain: () => void;
  onRevise: () => void;
  onUseExisting: () => void;
}) {
  const records = match.records;
  const latest = records[0];
  const title = match.style?.name ?? match.interpretation?.intent.name ?? "Existing style";
  return (
    <JobResult
      identity="Custom Style / Exists"
      kicker="Direction found"
      title={title}
      message={existingCopy(Boolean(match.style), records.length)}
      details={
        <>
          {direction.trim() ? <p className="job-result__note">{truncateDirection(direction)}</p> : null}
          {records.length > 0 ? (
            <ol className="job-result__records">
              {records.map((record, index) => (
                <li key={record.conceptId}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{recordLabel(record.recordNumber)} / {record.title}</strong>
                    <small>{[record.kitName, record.status].filter(Boolean).join(" · ")}</small>
                  </div>
                  <Link
                    className="system-state__link"
                    params={{ conceptId: record.conceptId }}
                    search={{ tab: "overview" }}
                    to="/library/$conceptId"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      }
      actions={
        <>
          {latest ? (
            <Button asChild>
              <Link params={{ conceptId: latest.conceptId }} search={{ tab: "overview" }} to="/library/$conceptId" onClick={onUseExisting}>
                Open latest record →
              </Link>
            </Button>
          ) : (
            <Button disabled={busy} onClick={onUseExisting}>
              {match.style ? "Use existing style →" : "Review previous →"}
            </Button>
          )}
          <Button disabled={busy || creditCost === undefined || (creditBalance !== undefined && creditCost !== undefined && creditBalance < creditCost)} onClick={onFormAgain} variant="outline">
            {busy ? "Forming…" : creditCost === undefined ? "Form again unavailable" : `Form again · ${creditCost} credit${creditCost === 1 ? "" : "s"}`}
          </Button>
        </>
      }
      secondary={
        <button className="system-state__link" disabled={busy} onClick={onRevise} type="button">
          Revise direction
        </button>
      }
    />
  );
}

function existingCopy(hasStyle: boolean, recordCount: number) {
  if (hasStyle && recordCount > 0) {
    return `This direction already has a saved style and ${recordCount} build${recordCount === 1 ? "" : "s"}. Open an existing record, or form a new style.`;
  }
  if (recordCount > 0) {
    return `This direction already has ${recordCount} build${recordCount === 1 ? "" : "s"}. Open an existing record, or form a new style.`;
  }
  if (hasStyle) {
    return "This style is already in your archive. Use it, or form a new style from the same direction.";
  }
  return "This direction was already formed. Review it, or form a new style.";
}

function recordLabel(recordNumber: number | null) {
  return recordNumber ? `N° ${String(recordNumber).padStart(4, "0")}` : "Record";
}

function StyleJobComplete({
  busy,
  direction,
  interpretation,
  onApply,
  onNewStyle,
  onRevise,
  onSave,
  phase,
}: {
  busy: boolean;
  direction: string;
  interpretation: InterpretationResult;
  onApply: () => void;
  onNewStyle: () => void;
  onRevise: () => void;
  onSave: () => void;
  phase: "review" | "stored";
}) {
  const stored = phase === "stored";
  return (
    <JobResult
      identity={stored ? "Custom Style / Stored" : "Custom Style / Review"}
      kicker={stored ? "In archive" : "Direction received"}
      title={interpretation.intent.name}
      message={stored
        ? "Saved privately. Apply it to a model, or start another direction."
        : "Review the formed style before you keep it or apply it to a model."}
      details={
        <>
          {direction.trim() ? <p className="job-result__note">{truncateDirection(direction)}</p> : null}
          <IntentSummary intent={interpretation.intent} />
          <p className="job-result__note">{interpretation.intent.surfaceLogic} · {interpretation.intent.markingDensity} markings</p>
        </>
      }
      actions={
        stored ? (
          <Button disabled={busy} onClick={onApply}>Apply to a kit →</Button>
        ) : (
          <>
            <Button disabled={busy} onClick={onSave}>Save style</Button>
            <Button disabled={busy} onClick={onApply}>Apply to a kit →</Button>
          </>
        )
      }
      secondary={
        <>
          {stored ? null : (
            <button className="system-state__link" disabled={busy} onClick={onRevise} type="button">
              Revise direction
            </button>
          )}
          <button className="system-state__link" disabled={busy} onClick={onNewStyle} type="button">
            New style
          </button>
        </>
      }
    />
  );
}

function truncateDirection(value: string) {
  const text = value.trim();
  return text.length > 88 ? `${text.slice(0, 85).trimEnd()}…` : text;
}

function costCopy(creditCost?: number, creditBalance?: number) {
  if (creditCost === undefined) return "Interpretation currently unavailable";
  if (creditBalance !== undefined && creditBalance < creditCost) {
    return `Needs ${creditCost} credit${creditCost === 1 ? "" : "s"} · ${creditBalance} available`;
  }
  return `Costs ${creditCost} credit${creditCost === 1 ? "" : "s"} · failed requests refunded`;
}

function convexErrorText(error: unknown) {
  const text = error instanceof Error ? error.message : "Unable to update style";
  return (text.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/)?.[1] ?? text.split("\n")[0]).replace(/^(?:Uncaught Error:\s*)+/, "");
}

export function IntentSummary({ intent }: { intent: StyleIntent }) {
  return <dl className="grid grid-cols-2 gap-3 text-sm">
    <div><dt>Palette</dt><dd>{Object.values(intent.palette).flat().join(" · ")}</dd></div>
    <div><dt>Finish</dt><dd>{intent.finish}</dd></div>
    <div><dt>Graphics</dt><dd>{intent.graphicLanguage}</dd></div>
    <div><dt>Weathering</dt><dd>{intent.weathering}</dd></div>
  </dl>;
}
