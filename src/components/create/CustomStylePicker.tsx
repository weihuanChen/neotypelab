import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { StyleIntent } from "@/convex/creativeContracts";
import type { InterpretationResult } from "@/convex/styleInterpretations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceChip } from "@/src/components/ui/workbench";

type Props = {
  userId: string;
  creditCost?: number;
  communityStyle?: string;
  selectedId: Id<"userStyles"> | null;
  onUse: (intent: StyleIntent, styleId: Id<"userStyles">) => void;
  onClear: () => void;
};
export function CustomStylePicker({ userId, creditCost, communityStyle, selectedId, onUse, onClear }: Props) {
  const [tab, setTab] = useState<"describe" | "mine" | "community">(communityStyle ? "community" : selectedId ? "mine" : "describe");
  const [description, setDescription] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storageKey = "neotypelab.style-draft:" + userId;
  const interpret = useAction(api.prototypeTools.interpretCustomStyle);
  const save = useMutation(api.userStyles.saveInterpretation);
  const copy = useMutation(api.userStyles.saveCommunityStyle);
  const setVisibility = useMutation(api.userStyles.setVisibility);
  const mine = useQuery(api.userStyles.mine);
  const community = useQuery(api.userStyles.community, tab === "community" ? {} : "skip");
  const source = useQuery(api.userStyles.getCommunityStyle, communityStyle ? { styleId: communityStyle } : "skip");
  const recovered = useQuery(api.styleInterpretations.latest, queryDescription ? { description: queryDescription } : "skip");
  const attempt = useQuery(api.styleInterpretations.requestState, requestKey ? { requestKey } : "skip");
  const checkingHistory = Boolean(description.trim()) && (description.trim() !== queryDescription || recovered === undefined || (requestKey !== null && attempt === undefined));
  const interpretation = result?.sourceDescription === description.trim() ? result
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
    setResult(response);
  }
  return <div className="custom-style-picker mt-6 space-y-6">
    <div className="choice-chip-row" aria-label="Custom style sources">
      <ChoiceChip compact active={tab === "describe"} onClick={() => setTab("describe")}>Describe a style</ChoiceChip>
      <ChoiceChip compact active={tab === "mine"} onClick={() => setTab("mine")}>My Styles</ChoiceChip>
      <ChoiceChip compact active={tab === "community"} onClick={() => setTab("community")}>Community</ChoiceChip>
    </div>
    {error ? <p role="alert" className="workbench-notice">{error}</p> : null}
    {tab === "describe" ? <div className="space-y-4">
      <label htmlFor="custom-style-description">Describe the repaint direction</label>
      <Textarea id="custom-style-description" value={description} maxLength={2000} disabled={busy}
        placeholder="Cyan and charcoal, with restrained racing graphics and a satin finish…"
        onChange={event => {
          setDescription(event.target.value); setRequestKey(null); setResult(null); onClear();
          try { sessionStorage.removeItem(storageKey); } catch { /* Optional recovery storage. */ }
        }} />
      <p>{interpretation ? "Your previous interpretation is ready to reuse. No additional credits." : creditCost === undefined ? "Style interpretation is currently unavailable. You can still use saved styles." : `Interpretation costs ${creditCost} credits. Failed interpretations are refunded.`}</p>
      {!interpretation ? <Button disabled={busy || checkingHistory || creditCost === undefined || !description.trim()} onClick={() => { void run(onInterpret); }}>
        {busy ? "Interpreting…" : checkingHistory ? "Checking saved interpretation…" : attempt?.status === "ready" ? "Check interpretation" : "Interpret style"}
      </Button> : <>
        <div><p>Style interpretation</p><h3>{interpretation.intent.name}</h3></div>
        <IntentSummary intent={interpretation.intent} />
        <Button disabled={busy} onClick={() => { void run(async () => {
          const saved = await save({ promptCompositionId: interpretation.promptCompositionId as Id<"promptCompositions"> });
          onUse(saved.intent, saved.styleId); setTab("mine");
        }); }}>Save privately and use this style</Button>
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
    {tab === "community" ? <div className="space-y-4">
      <p>Save a style to your collection, then apply it to a kit. <a href="/community/styles">Browse the community →</a></p>
      {communityStyle && source === null ? <p>This shared style is no longer available.</p> : null}
      {community === undefined ? <p>Loading community styles…</p> : community.length === 0 ? <p>No community styles have been published yet.</p> :
        [...community].sort((a, b) => Number(b.id === communityStyle) - Number(a.id === communityStyle)).map(style =>
          <article key={style.id} className="workbench-notice space-y-3">
            <strong>{style.name}</strong><p>By {style.creator.name} · {style.saveCount} saves · {style.publicPrototypeCount} public prototypes</p>
            <IntentSummary intent={style.intent} />
            <Button disabled={busy} onClick={() => { void run(async () => {
              const saved = await copy({ styleId: style.id }); onUse(saved.intent, saved.styleId); setTab("mine");
            }); }}>Save and use this style</Button>
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
