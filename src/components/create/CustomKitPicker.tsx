"use client";

import { useEffect, useState, type DragEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { kitReferenceTypes, maxKitReferenceBytes, type CustomKitSnapshot, type KitChanges } from "@/convex/customKitContracts";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { kitReferenceProviderNote } from "@/src/lib/aiDisclosure";

export type CustomKitSelection = { id: Id<"customKits">; versionId: Id<"customKitVersions"> | null; name: string; portrait: string | null };
const emptyChanges: KitChanges = { corrections: [], requestedEdits: [] };
const trackSteps = ["Upload", "Scan", "Confirm"] as const;

export function CustomKitPicker({ selectedId, disabled, onChange }: {
  selectedId: Id<"customKits"> | null; disabled: boolean; onChange: (selection: CustomKitSelection | null) => void;
}) {
  const availability = useQuery(api.customKits.availability);
  const mine = useQuery(api.customKits.mine);
  const kit = useQuery(api.customKits.get, selectedId ? { kitId: selectedId } : "skip");
  const prepare = useAction(api.customKitsNode.prepareUpload);
  const finish = useAction(api.customKitsNode.finishUpload);
  const scan = useAction(api.customKitsNode.scan);
  const confirm = useMutation(api.customKits.confirm);
  const remove = useMutation(api.customKits.remove);
  const portrait = usePrivateAssetUrl(kit && !kit.blocked ? kit.storageObjectId : undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState<{ url: string; kitId: Id<"customKits"> | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<KitChanges>(emptyChanges);
  const [draftVersion, setDraftVersion] = useState<string | null>(null);
  const snapshot = kit?.snapshotJson ? JSON.parse(kit.snapshotJson) as CustomKitSnapshot : null;
  const dirty = Boolean(snapshot && JSON.stringify(changes) !== JSON.stringify({ corrections: snapshot.corrections, requestedEdits: snapshot.requestedEdits }));
  const working = disabled || busy || kit?.scanStatus === "running";
  const reference = kit && !kit.blocked ? kit : null;
  const stage = !reference ? 0 : !snapshot ? 1 : reference.confirmed && !dirty ? 3 : 2;
  const referenceImage = portrait ?? (reference && localPreview?.kitId === reference.id ? localPreview.url : null);
  useEffect(() => {
    const value = kit?.snapshotJson ? JSON.parse(kit.snapshotJson) as CustomKitSnapshot : null;
    setChanges(value ? { corrections: value.corrections, requestedEdits: value.requestedEdits } : emptyChanges);
    setDraftVersion(kit?.versionId ?? null);
    setError(null);
  }, [kit?.snapshotJson, kit?.versionId]);
  useEffect(() => {
    if (!selectedId || kit === undefined) return;
    if (!kit) { onChange(null); return; }
    onChange({ id: kit.id, versionId: kit.confirmed && !dirty && draftVersion === kit.versionId && !busy ? kit.versionId : null, name: kit.name, portrait });
  }, [selectedId, kit, dirty, draftVersion, busy, portrait, onChange]);
  const previewUrl = localPreview?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function upload(file: File | undefined) {
    if (!file || working) return;
    setError(null);
    const problem = await checkReference(file);
    if (problem) { setError(problem); return; }
    const kitName = name.trim() || nameFromFile(file.name);
    setBusy(true); setUploading(true);
    const url = URL.createObjectURL(file);
    setLocalPreview({ url, kitId: null });
    try {
      const ticket = await prepare({ name: kitName, contentType: file.type, byteSize: file.size });
      const response = await fetch(ticket.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Reference upload failed. Try again.");
      const id = await finish({ uploadId: ticket.uploadId });
      setName("");
      setLocalPreview({ url, kitId: id });
      onChange({ id, versionId: null, name: kitName, portrait: null });
    } catch (failure) { setError(message(failure)); setLocalPreview(null); }
    finally { setBusy(false); setUploading(false); }
  }
  async function runScan() {
    if (!kit || working) return;
    if (availability?.scanCost == null) { setError("Scan pricing is unavailable. Try again later."); return; }
    setBusy(true); setError(null);
    try { await scan({ kitId: kit.id, expectedCost: availability.scanCost }); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!kit?.versionId || working) return;
    setBusy(true); setError(null);
    try { await confirm({ kitId: kit.id, expectedVersionId: kit.versionId, changesJson: JSON.stringify(changes) }); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  async function removeKit() {
    if (!kit || working) return;
    setBusy(true); setError(null);
    try { await remove({ kitId: kit.id }); onChange(null); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  function correct(partId: string, description: string) {
    setChanges(current => ({ ...current, corrections: [
      ...current.corrections.filter(item => item.partId !== partId), ...(description.trim() ? [{ partId, description }] : []),
    ].sort((a, b) => a.partId.localeCompare(b.partId)) }));
  }
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  const dropzone = <label className={`custom-kit-drop${reference ? " is-compact" : ""}${dragging ? " is-dragging" : ""}${uploading ? " is-uploading" : ""}`} htmlFor="custom-kit-file" aria-busy={uploading || undefined}
    onDragOver={event => { event.preventDefault(); if (!working) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <input id="custom-kit-file" className="custom-kit-file" type="file" accept={kitReferenceTypes.join(",")} disabled={working} aria-describedby="custom-kit-spec" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
    <span className="custom-kit-drop-marks" aria-hidden="true" />
    {reference ? null : <span className="custom-kit-drop-tag" aria-hidden="true">Your kit</span>}
    {uploading && previewUrl ? <img className="custom-kit-drop-preview" src={previewUrl} alt="" /> : null}
    <span className="custom-kit-drop-title">{uploading ? "Uploading your reference…" : reference ? "Replace with a new reference" : <>Drop your mecha here<small>or click to choose one image</small></>}</span>
    <span className="custom-kit-drop-spec" id="custom-kit-spec">PNG, JPG or WebP · up to 8 MB · 256–4096 px per side</span>
  </label>;
  const nameField = <label className="custom-kit-field" htmlFor="custom-kit-name">New Kit name<Input id="custom-kit-name" value={name} maxLength={80} disabled={working} placeholder="Optional · defaults to the file name" onChange={event => setName(event.target.value)} /></label>;
  const savedField = mine?.length ? <label className="custom-kit-field">Saved Custom Kits<select disabled={working} value={selectedId ?? ""} onChange={event => onChange(event.target.value ? { id: event.target.value as Id<"customKits">, versionId: null, name: "Custom Kit", portrait: null } : null)}><option value="">Upload a new reference</option>{mine.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null;

  return <section className="custom-kit-picker" aria-label="Custom Kit reference">
    <header className="custom-kit-header"><p className="workbench-kicker">Your kit · one reference image</p><h2>Bring your own kit.</h2><p>Upload a robot or mecha photo, line art or concept image. Its reference stays private when you publish your build.</p></header>
    {!availability?.enabled ? <p role="status">Custom Kit is being prepared. Your official kits are available in the catalog.</p> : <>
      <ol className="custom-kit-track" aria-label="Custom Kit progress">{trackSteps.map((label, index) => <li key={label} className={index < stage ? "is-done" : index === stage ? "is-current" : undefined} aria-current={index === stage ? "step" : undefined}><i aria-hidden="true" />{`0${index + 1} · ${label}`}</li>)}</ol>
      {kit?.blocked ? <p className="custom-kit-blocked" role="alert"><strong>Image not accepted.</strong> {kit.scanResultJson ? (JSON.parse(kit.scanResultJson) as { reason: string }).reason : null} The scan used its displayed credits. Upload a different reference to continue.</p> : null}
      {reference ? savedField : <>{dropzone}<div className="custom-kit-upload-meta">{nameField}{savedField}</div></>}
      <p className="custom-kit-hint">One clear primary mecha; animal-shaped robots and original designs are welcome. Images that break the AI Acceptable Use Policy are rejected and deleted. {kitReferenceProviderNote}</p>
      {kit && !kit.blocked ? <section className="custom-kit-observations" aria-label="Reference structure">
        <div className="custom-kit-reference-heading"><div><p className="workbench-kicker">Custom Kit</p><h3>{kit.name}</h3></div>{referenceImage ? <img src={referenceImage} alt={`${kit.name} private reference`} /> : null}</div>
        {!snapshot ? <><button type="button" className="psy-btn" disabled={working} aria-busy={busy || kit.scanStatus === "running"} onClick={() => void runScan()}>{working ? "Scanning reference…" : `Scan reference · ${availability.scanCost ?? "—"} credits`}</button>
          <p>One scan checks content safety, suitability and visible parts. Completed scans are reused; technical failures are refunded. An unsuitable, unclear or policy-blocked result is a completed scan and uses the displayed credits.</p>
          {kit.scanResultJson ? <p role="status">{(JSON.parse(kit.scanResultJson) as { reason: string }).reason} Upload a clearer robot or mecha reference to continue.</p> : null}</> : <>
          <p className="custom-kit-scan-reason">{snapshot.observations.reason}</p>
          <details open={!kit.confirmed}><summary>Visible structure · {snapshot.observations.parts.length} parts</summary><p>Correct a mistaken description here. Structural changes belong in the modification section below.</p>
            {snapshot.observations.parts.map(part => <div className="custom-kit-part" key={part.id}><div><strong>{part.name}</strong><small>{part.id} · {part.visibility}</small><p>{part.description}</p></div>
              {part.visibility !== "not-visible" ? <label>Correction for {part.name}<Textarea disabled={working} value={changes.corrections.find(item => item.partId === part.id)?.description ?? ""} rows={2} maxLength={600} placeholder="Leave empty to keep the scan observation" onChange={event => correct(part.id, event.target.value)} /></label> : null}</div>)}
            {snapshot.observations.uncertainFeatures.length ? <div className="custom-kit-unknown"><strong>Not confirmed by this reference</strong><ul>{snapshot.observations.uncertainFeatures.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}</details>
          <details open={changes.requestedEdits.length > 0}><summary>Modify structure · optional</summary><p>Choose a visible part and describe a local change. Other parts stay as referenced. Added parts are concept proposals; the image does not verify physical assembly.</p>
            {changes.requestedEdits.map((edit, index) => <fieldset className="custom-kit-edit" disabled={working} key={index}><legend>Modification {index + 1}</legend>
              <label>Part<select value={edit.partId} onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, partId: event.target.value } : item) }))}>{snapshot.observations.parts.filter(part => part.visibility !== "not-visible").map(part => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>
              <label>Action<select value={edit.action} onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, action: event.target.value as typeof edit.action } : item) }))}>{["adjust", "expand", "replace", "add"].map(action => <option key={action} value={action}>{action}</option>)}</select></label>
              <label>Description<Textarea value={edit.description} maxLength={600} rows={2} placeholder="Slightly thicken the shoulder armor; keep its existing panel layout." onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, description: event.target.value } : item) }))} /></label>
              <button type="button" onClick={() => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.filter((_, i) => i !== index) }))}>Remove modification</button></fieldset>)}
            <Button variant="outline" disabled={working || changes.requestedEdits.length >= 8} onClick={() => setChanges(current => ({ ...current, requestedEdits: [...current.requestedEdits, { partId: snapshot.observations.parts.find(part => part.visibility !== "not-visible")!.id, action: "adjust", description: "" }] }))}>Add a local modification</Button></details>
          {kit.confirmed && !dirty ? <Button variant="outline" disabled>Structure confirmed</Button> : <button type="button" className="psy-btn" disabled={working} aria-busy={busy || undefined} onClick={() => void save()}>Confirm structure and modifications</button>}
          <p role="status">{kit.confirmed && !dirty ? "Ready for your style. The preview keeps this reference view." : "Confirm your structure before generating a preview."}</p>
        </>}
        {kit.error ? <p role="alert">{kit.error} Scan credits were returned.</p> : null}
        <Button variant="outline" disabled={working} onClick={() => void removeKit()}>Remove saved Kit and private reference</Button>
        <p>Removing the reference keeps completed builds and paint plans, but prevents future renders using this reference.</p>
      </section> : null}
      {reference ? <div className="custom-kit-replace">{dropzone}{nameField}</div> : null}
    </>}
    {error ? <p className="create-flow-error" role="alert">{error}</p> : null}
  </section>;
}

/** Free local pre-check so an obviously invalid file never reaches upload; the server still validates. */
async function checkReference(file: File) {
  if (!(kitReferenceTypes as readonly string[]).includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > maxKitReferenceBytes) return "This image is larger than 8 MB. Export a smaller copy and try again.";
  const size = await imageSize(file);
  if (size && (Math.min(size.width, size.height) < 256 || Math.max(size.width, size.height) > 4096)) return `This image is ${size.width}×${size.height} px. Each side needs to be 256–4096 px.`;
  return null;
}

function imageSize(file: File) {
  return new Promise<{ width: number; height: number } | null>(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    image.src = url;
  });
}

function nameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "My custom kit";
}

function message(error: unknown) {
  return error instanceof Error ? (error.message.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/)?.[1] ?? error.message.split("\n")[0]) : "Could not update this Custom Kit";
}
