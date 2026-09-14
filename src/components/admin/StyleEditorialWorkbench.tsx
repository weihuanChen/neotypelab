import { CommunityStyleCuration } from "./CommunityStyleCuration";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StyleEditorialWorkbench() {
  const workspace = useQuery(api.styleEditorial.adminWorkspace);
  const save = useMutation(api.styleEditorial.saveOfficialIntent);
  const review = useMutation(api.styleEditorial.reviewConcept);
  const withdraw = useMutation(api.styleEditorial.withdraw);
  const [styleId, setStyleId] = useState("");
  const [intentJson, setIntentJson] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = workspace?.styles.find(style => style.id === styleId);
  useEffect(() => {
    setIntentJson(selected?.intentJson ?? "");
    setConceptId("");
    setConfirmed(false);
  }, [selected?.id, selected?.intentJson]);
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setNotice("");
    try { await task(); setNotice(message); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save review"); }
    finally { setBusy(false); }
  }
  return <div className="workbench-page">
    <header className="admin-workspace-head"><p>Content / Editorial</p><h2>Official style studies</h2>
      <span>Prepare an official intent, then review a public preview and its frozen catalog paint mapping.</span></header>
    <a href="/admin/styles">← Style library</a>
    {notice ? <p role="status">{notice}</p> : null}
    {!workspace ? <p>Loading editorial workspace…</p> : <>
      <section className="workbench-step">
        <h3>1. Official style intent</h3>
        <p>Saving an intent does not publish a page. Changing it hides previous reviews until matching previews are approved again.</p>
        <Select value={styleId} onValueChange={setStyleId} disabled={busy}>
          <SelectTrigger aria-label="Style to curate"><SelectValue placeholder="Select a style" /></SelectTrigger>
          <SelectContent>{workspace.styles.map(style => <SelectItem key={style.id} value={style.id}>{style.name}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea className="mt-4 min-h-64 font-mono text-sm" aria-label="Official Style Intent JSON" value={intentJson} onChange={e => setIntentJson(e.target.value)} disabled={busy} placeholder={'{"version":"style-intent.v1","source":"official","styleType":"preset", ...}'} />
        <p>Supply a complete Style Intent v1. Use a visual-language name, an official source and preset type. Generate new concepts after saving this intent.</p>
        <Button disabled={busy || !styleId || !intentJson.trim()} onClick={() => { void run(() => save({ stylePresetId: styleId as Id<"stylePresets">, intentJson }), "Official intent saved. Generate and review a matching preview next."); }}>Save official intent</Button>
      </section>
      <section className="workbench-step">
        <h3>2. Review a model study</h3>
        <p>Only existing public preset concepts with frozen intent, palette and repaint specification appear here.</p>
        <Select value={conceptId} disabled={busy || !styleId} onValueChange={value => { setConceptId(value); setConfirmed(false); }}>
          <SelectTrigger aria-label="Concept to review"><SelectValue placeholder="Select a public concept" /></SelectTrigger>
          <SelectContent>{workspace.candidates.filter(c => c.styleId === styleId).map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        {conceptId ? <p><a className="underline" href={`/prototype/${conceptId}`} target="_blank" rel="noreferrer">Open preview and paint mapping ↗</a></p> : null}
        <label className="my-4 flex items-center gap-2"><input type="checkbox" checked={confirmed} disabled={busy || !conceptId} onChange={e => setConfirmed(e.target.checked)} />I reviewed the kit identity, style fidelity and catalog paint mapping.</label>
        <Button disabled={busy || !conceptId || !confirmed} onClick={() => { void run(() => review({ conceptId: conceptId as Id<"concepts">, confirmed }), "Reviewed pairing published in Styles."); }}>Publish reviewed pairing</Button>
      </section>
      <section className="workbench-step">
        <h3>3. Published reviews</h3>
        {workspace.reviews.filter(r => r.styleId === styleId).map(r => <div className="my-4 flex flex-wrap items-center gap-4" key={r.id}>
          <a href={`/prototype/${r.conceptId}`}>Open reviewed prototype</a>
          <span>{r.live ? "Live" : r.isPublished ? "Hidden: source or intent changed" : "Withdrawn"}</span>
          <Button variant="outline" disabled={busy || !r.isPublished} onClick={() => { void run(() => withdraw({ reviewId: r.id }), "Review withdrawn."); }}>Withdraw</Button>
        </div>)}
        <a href="/styles">Open Styles →</a>
      </section>
      <CommunityStyleCuration />
    </>}
  </div>;
}
