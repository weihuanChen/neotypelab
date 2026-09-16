import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { StyleIntent } from "@/convex/creativeContracts";
import type { InterpretationResult } from "@/convex/styleInterpretations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";


type Props = {
  userId: string;
  creditCost?: number;
  selectedId: Id<"userStyles"> | null;
  onUse: (intent: StyleIntent, styleId: Id<"userStyles">) => void;
  onClear: () => void;
  view: "describe" | "mine";
  onApply: () => void;
};
export function CustomStylePicker({ userId, creditCost, selectedId, onUse, onClear, view: tab, onApply }: Props) {
  const [description, setDescription] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [savedResult, setSavedResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storageKey = "neotypelab.style-draft:" + userId;
  const interpret = useAction(api.prototypeTools.interpretCustomStyle);
  const save = useMutation(api.userStyles.saveInterpretation);
  const setVisibility = useMutation(api.userStyles.setVisibility);
  const mine = useQuery(api.userStyles.mine);
  const recovered = useQuery(api.styleInterpretations.latest, queryDescription ? { description: queryDescription } : "skip");
  const attempt = useQuery(api.styleInterpretations.requestState, requestKey ? { requestKey } : "skip");
  const checkingHistory = Boolean(description.trim()) && (description.trim() !== queryDescription || recovered === undefined || (requestKey !== null && attempt === undefined));
  const interpretation = adjusting ? null : result?.sourceDescription === description.trim() ? result
    : recovered?.sourceDescription === description.trim() ? recovered : null;
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
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update style"); }
    finally { setBusy(false); }
  }
  async function onInterpret() {
    onClear();
    const key = requestKey && attempt?.status !== "failed" ? requestKey : crypto.randomUUID();
    setRequestKey(key);
    try { sessionStorage.setItem(storageKey, JSON.stringify({ description, requestKey: key })); } catch { /* Optional recovery storage. */ }
    const response = await interpret({ description, requestKey: key });
    setResult(response); setAdjusting(false); setSavedResult(null);
  }
  return <div className="custom-style-picker mt-6 space-y-6">
    {error ? <p role="alert" className="workbench-notice">{error}</p> : null}
    {tab === "describe" ? <div className="style-command">
      {interpretation ? <>
        <p className="style-command-kicker">Style interpreted</p>
        <h2>{interpretation.intent.name}</h2>
        <IntentSummary intent={interpretation.intent} />
        <p>{interpretation.intent.surfaceLogic} · {interpretation.intent.markingDensity} markings</p>
        <div className="style-command-actions">
          <Button variant="outline" disabled={busy} onClick={() => { setAdjusting(true); onClear(); }}>Adjust</Button>
          <Button disabled={busy || savedResult === interpretation.promptCompositionId} onClick={() => { void run(async () => {
            const saved = await save({ promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
            onUse(saved.intent, saved.styleId); setSavedResult(interpretation.promptCompositionId);
          }); }}>{savedResult === interpretation.promptCompositionId ? "Saved privately" : "Save style"}</Button>
        </div>
        <Button disabled={busy} onClick={() => { void run(async () => {
          const saved = await save({ promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
          onUse(saved.intent, saved.styleId); onApply();
        }); }}>Apply to a model →</Button>
      </> : <>
        <p className="style-command-kicker">Create a style</p>
        <h2>What should this kit become?</h2>
        <Textarea aria-label="Describe your repaint idea" value={description} maxLength={2000} disabled={busy}
          placeholder="Describe a color scheme, character, era, design language, or mood…"
          onChange={event => {
            setDescription(event.target.value); setRequestKey(null); setResult(null); onClear();
            try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
          }} />
        <div className="style-command-examples">{["Crimson armor with restrained gold accents", "Cyan idol colors with racing graphics", "Cold-war naval aviation"].map(example =>
          <button type="button" key={example} disabled={busy} onClick={() => { setDescription(example); setRequestKey(null); setResult(null); onClear(); }}>“{example}”</button>)}</div>
        <Button disabled={busy || checkingHistory || creditCost === undefined || !description.trim()} onClick={() => { void run(onInterpret); }}>
          {busy ? "Interpreting…" : checkingHistory ? "Checking saved interpretation…" : "Interpret →"}
        </Button>
        <p className="style-command-cost">{creditCost === undefined ? "Interpretation currently unavailable" : `Costs ${creditCost} credit${creditCost === 1 ? "" : "s"} · failed requests refunded`}</p>
      </>}
    </div> : null}
    {tab === "mine" ? <div className="space-y-5">
      <p>Styles are private until you publish them. Making a style private stops new saves; existing private copies remain.</p>
      {mine === undefined ? <p>Loading your styles…</p> : mine.length === 0 ? <p>No saved styles yet. Interpret a direction to create your first.</p> : mine.map(style =>
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
export function IntentSummary({ intent }: { intent: StyleIntent }) {
  return <dl className="grid grid-cols-2 gap-3 text-sm">
    <div><dt>Palette</dt><dd>{Object.values(intent.palette).flat().join(" · ")}</dd></div>
    <div><dt>Finish</dt><dd>{intent.finish}</dd></div>
    <div><dt>Graphics</dt><dd>{intent.graphicLanguage}</dd></div>
    <div><dt>Weathering</dt><dd>{intent.weathering}</dd></div>
  </dl>;
}
