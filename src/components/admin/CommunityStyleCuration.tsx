import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IntentSummary } from "@/src/components/create/CustomStylePicker";

export function CommunityStyleCuration() {
  const candidates = useQuery(api.userStyles.adminCommunity);
  const promote = useMutation(api.userStyles.promote);
  const moderate = useMutation(api.userStyles.moderate);
  const [selectedId, setSelectedId] = useState<Id<"userStyles"> | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = candidates?.find(row => row.id === selectedId);
  useEffect(() => {
    setName(selected?.name ?? ""); setSlug(""); setDescription(""); setConfirmed(false);
  }, [selected?.id, selected?.name]);
  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice("");
    try { await task(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to curate style"); }
    finally { setBusy(false); }
  }
  return <section className="workbench-step space-y-4">
    <h3>4. Community curation</h3>
    <p>Promote a community direction into an inactive official preset draft. Enable it in the Style library, generate matching previews, then complete the review above.</p>
    {notice ? <p role="status">{notice}</p> : null}
    {candidates === undefined ? <p>Loading community styles…</p> : !candidates.length ? <p>No community candidates yet.</p> :
      <div className="space-y-4">{candidates.map(style => <article key={style.id} className="flex flex-wrap items-center gap-4">
        <Button variant="outline" onClick={() => setSelectedId(style.id)} disabled={busy}>{style.name}</Button>
        <span>{style.saveCount} saves · {style.status}{style.promotedPresetId ? " · Official draft created" : ""}</span>
        <a href={`/c/${style.id}`} target="_blank" rel="noreferrer">Open shared style</a>
        <Button variant="outline" disabled={busy} onClick={() => { void run(() => moderate({ styleId: style.id, hidden: style.status !== "hidden" }), "Community visibility updated."); }}>{style.status === "hidden" ? "Restore" : "Hide"}</Button>
      </article>)}</div>}
    {selected ? <div className="space-y-4">
      <IntentSummary intent={selected.intent} />
      <label className="block">Official name<Input value={name} maxLength={120} onChange={e => setName(e.target.value)} disabled={busy} /></label>
      <label className="block">Official slug<Input value={slug} maxLength={120} onChange={e => setSlug(e.target.value)} disabled={busy} placeholder="cyan-performance" /></label>
      <label className="block">Description<Textarea value={description} maxLength={1500} onChange={e => setDescription(e.target.value)} disabled={busy} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />I reviewed the visual language and attribution for this official draft.</label>
      <Button disabled={busy || !confirmed || !name.trim() || !slug.trim() || !description.trim() || selected.status === "hidden" || Boolean(selected.promotedPresetId)}
        onClick={() => { void run(() => promote({ styleId: selected.id, name, slug, description, confirmed }), "Official preset draft created. It is not indexed until P4 review is completed."); }}>Promote to preset draft</Button>
    </div> : null}
  </section>;
}
