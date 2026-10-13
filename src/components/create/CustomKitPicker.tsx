"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
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
const trackSteps = ["Upload", "Check parts", "Confirm"] as const;
const visibilityLabel = { visible: "Fully visible", partial: "Partly visible", "not-visible": "Not visible" } as const;
const actionLabel = { adjust: "Adjust", expand: "Make bigger", replace: "Replace", add: "Add a new part" } as const;
/** Below this shortest side a reference still works, but small details may be missed. */
const comfortableReferencePx = 1024;

export function CustomKitPicker({ selectedId, disabled, onChange, readyAction }: {
  selectedId: Id<"customKits"> | null; disabled: boolean; onChange: (selection: CustomKitSelection | null) => void;
  /** Shown beside "Ready" so the next step sits where the user is looking. */
  readyAction?: ReactNode;
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
  const [fileInfo, setFileInfo] = useState<{ kitId: Id<"customKits"> | null; fileName: string; bytes: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ src: string; width: number; height: number } | null>(null);
  const [openFixes, setOpenFixes] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [scanning, setScanning] = useState(false);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapshot = kit?.snapshotJson ? JSON.parse(kit.snapshotJson) as CustomKitSnapshot : null;
  const dirty = Boolean(snapshot && JSON.stringify(changes) !== JSON.stringify({ corrections: snapshot.corrections, requestedEdits: snapshot.requestedEdits }));
  const working = disabled || busy || kit?.scanStatus === "running";
  const reference = kit && !kit.blocked ? kit : null;
  const stage = !reference ? 0 : !snapshot ? 1 : reference.confirmed && !dirty ? 3 : 2;
  const localImage = reference && localPreview?.kitId === reference.id ? localPreview.url : null;
  const referenceImage = portrait ?? localImage;
  const isScanning = scanning || kit?.scanStatus === "running";
  const size = dimensions && dimensions.src === referenceImage ? dimensions : null;
  const file = reference && fileInfo?.kitId === reference.id ? fileInfo : null;
  useEffect(() => {
    const value = kit?.snapshotJson ? JSON.parse(kit.snapshotJson) as CustomKitSnapshot : null;
    setChanges(value ? { corrections: value.corrections, requestedEdits: value.requestedEdits } : emptyChanges);
    setDraftVersion(kit?.versionId ?? null);
    setOpenFixes(value?.corrections.map(item => item.partId) ?? []);
    setConfirmRemove(false);
    setError(null);
  }, [kit?.snapshotJson, kit?.versionId]);
  useEffect(() => {
    if (!selectedId || kit === undefined) return;
    if (!kit) { onChange(null); return; }
    onChange({ id: kit.id, versionId: kit.confirmed && !dirty && draftVersion === kit.versionId && !busy ? kit.versionId : null, name: kit.name, portrait: kit.blocked ? null : referenceImage });
  }, [selectedId, kit, dirty, draftVersion, busy, referenceImage, onChange]);
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
      if (!response.ok) throw new Error("Upload didn’t finish. Check your connection and try again.");
      const id = await finish({ uploadId: ticket.uploadId });
      setName("");
      setLocalPreview({ url, kitId: id });
      setFileInfo({ kitId: id, fileName: file.name, bytes: file.size });
      onChange({ id, versionId: null, name: kitName, portrait: url });
    } catch (failure) { setError(message(failure)); setLocalPreview(null); }
    finally { setBusy(false); setUploading(false); }
  }
  async function runScan() {
    if (!kit || working) return;
    if (availability?.scanCost == null) { setError("Checking is unavailable right now. Try again in a few minutes."); return; }
    setBusy(true); setScanning(true); setError(null);
    try { await scan({ kitId: kit.id, expectedCost: availability.scanCost }); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); setScanning(false); }
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
    <input ref={fileInputRef} id="custom-kit-file" className="custom-kit-file" type="file" accept={kitReferenceTypes.join(",")} disabled={working} aria-describedby="custom-kit-spec" onChange={event => { const picked = event.target.files?.[0]; event.target.value = ""; void upload(picked); }} />
    <span className="custom-kit-drop-marks" aria-hidden="true" />
    {reference ? null : <span className="custom-kit-drop-tag" aria-hidden="true">Your kit</span>}
    {uploading && previewUrl ? <img className="custom-kit-drop-preview" src={previewUrl} alt="" /> : null}
    <span className="custom-kit-drop-title">{uploading ? "Uploading your photo…" : reference ? "Drop a different photo to replace it" : <>Drop a photo of your kit here<small>or click to choose a file</small></>}</span>
    <span className="custom-kit-drop-spec" id="custom-kit-spec">PNG, JPG or WebP · up to 8 MB · 256–4096 px per side</span>
  </label>;
  const nameField = <label className="custom-kit-field" htmlFor="custom-kit-name">Name (optional)<Input id="custom-kit-name" value={name} maxLength={80} disabled={working} placeholder="We’ll use the file name if you leave this empty" onChange={event => setName(event.target.value)} /></label>;
  const savedField = mine?.length ? <label className="custom-kit-field">Your uploaded kits<select disabled={working} value={selectedId ?? ""} onChange={event => onChange(event.target.value ? { id: event.target.value as Id<"customKits">, versionId: null, name: "Custom Kit", portrait: null } : null)}><option value="">Upload a new photo</option>{mine.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null;
  const visibleParts = snapshot?.observations.parts.filter(part => part.visibility !== "not-visible") ?? [];
  const hiddenNotes = snapshot ? [...snapshot.observations.parts.filter(part => part.visibility === "not-visible").map(part => part.name), ...snapshot.observations.uncertainFeatures] : [];
  const ready = Boolean(kit?.confirmed && !dirty);

  const beforeScan = Boolean(reference && !snapshot);
  const progress = <ol className="custom-kit-track" aria-label="Upload progress">{trackSteps.map((label, index) => <li key={label} className={index < stage ? "is-done" : index === stage ? "is-current" : undefined} aria-current={index === stage ? "step" : undefined}><i aria-hidden="true" />{`${index + 1} · ${label}`}</li>)}</ol>;
  const fileDetails = reference ? <div className="custom-kit-file-details"><strong>{reference.name}</strong><small>{[file?.fileName, size ? `${size.width} × ${size.height} px` : null, file ? formatBytes(file.bytes) : null].filter(Boolean).join(" · ") || "Your upload"}</small></div> : null;
  const fileActions = confirmRemove ? <div className="custom-kit-plate-remove" role="group" aria-label="Remove this kit">
    <p>Remove this kit? Your finished previews and paint plans stay. You just won’t be able to make new ones from this photo.</p>
    <button type="button" disabled={working} onClick={() => void removeKit()}>Remove kit</button><button type="button" onClick={() => setConfirmRemove(false)}>Cancel</button>
  </div> : <div className="custom-kit-plate-actions">
    <button type="button" disabled={working} onClick={() => fileInputRef.current?.click()}>Replace photo</button>
    <button type="button" disabled={working} onClick={() => setConfirmRemove(true)}>Remove</button>
  </div>;
  const checklist = <div className="custom-kit-checklist"><p>What the check looks at</p><ul>
    <li>One robot or mecha in the frame</li>
    <li>Which parts are visible: head, chest, arms, legs and more</li>
    <li>Whether the photo is clear enough to keep its shape</li>
  </ul></div>;
  const fileCard = <div className="custom-kit-file-card">{fileDetails}{fileActions}{savedField}</div>;
  const plate = reference ? <figure className={`custom-kit-plate${isScanning ? " is-scanning" : ""}${dragging ? " is-dragging" : ""}`}>
    <div className="custom-kit-plate-stage" onDragOver={event => { event.preventDefault(); if (!working) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }}>
      <span className="custom-kit-plate-tag">Private · only you see this</span>
      {referenceImage ? <button type="button" className="custom-kit-plate-open" onClick={() => lightboxRef.current?.showModal()} aria-label={`View ${reference.name} full size`}>
        <img src={referenceImage} alt={`${reference.name}, your uploaded kit`} onLoad={event => setDimensions({ src: event.currentTarget.currentSrc || event.currentTarget.src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
      </button> : <span className="custom-kit-plate-loading" role="status">Loading your photo…</span>}
      <span className="custom-kit-plate-beam" aria-hidden="true" />
      {referenceImage ? <span className="custom-kit-plate-zoom" aria-hidden="true">View full size</span> : null}
    </div>
    {size && Math.min(size.width, size.height) < comfortableReferencePx ? <p className="custom-kit-plate-warn">This image is small ({size.width} × {size.height} px). It will work, but fine details like vents and antennas may be missed. {comfortableReferencePx} px or larger works best.</p> : null}
    {beforeScan ? null : <figcaption className="custom-kit-plate-caption">{fileDetails}{fileActions}</figcaption>}
  </figure> : null;

  return <section className="custom-kit-picker" aria-label="Upload your kit">
    <header className={`custom-kit-header${reference ? " is-compact" : ""}`}><h2>Paint your own kit</h2>
      {reference ? null : <p>Upload one photo, line art or concept image of your robot. We keep its shape and only change the colors. The photo stays private, even if you publish the result.</p>}
      {reference && availability?.enabled ? progress : null}</header>
    {!availability?.enabled ? <p role="status">Uploading your own kit is coming soon. For now, choose a kit from the catalog.</p> : <>
      {reference ? null : progress}
      {kit?.blocked ? <p className="custom-kit-blocked" role="alert"><strong>We can’t use this image.</strong> {kit.scanResultJson ? (JSON.parse(kit.scanResultJson) as { reason: string }).reason : null} The check used its credits. Upload a different photo to continue.</p> : null}
      {reference ? null : <>{dropzone}<div className="custom-kit-upload-meta">{nameField}{savedField}</div>
        <p className="custom-kit-hint">A straight front view works best: the preview keeps this angle, and the paint plan covers the parts this photo shows. One robot, clearly visible. Original designs and animal-shaped robots are welcome. Images that break our acceptable use policy are rejected and deleted. {kitReferenceProviderNote}</p></>}
      {reference ? <div className={`custom-kit-reference${beforeScan ? " is-before-scan" : ""}`}>
        {plate}
        <div className="custom-kit-steps">
          {!snapshot ? isScanning ? <>
            <h3>Checking your image…</h3>
            <p>Confirming this is a robot or mecha, then listing every part we can see.</p>
            <p className="custom-kit-status" role="status"><i aria-hidden="true" />Usually about 20 seconds. You can stay on this page.</p>
            {checklist}
            {fileCard}
          </> : <>
            <h3>{reference.scanResultJson ? "Try a clearer photo" : "Looks good. Next, check its parts."}</h3>
            {reference.scanResultJson ? <p role="status">{(JSON.parse(reference.scanResultJson) as { reason: string }).reason} Try a clearer photo with one robot in the frame.</p>
              : <p>We look at the image once to confirm it’s a robot and list the parts we can see: head, chest, arms, legs and so on. You can fix anything we get wrong.</p>}
            {reference.scanResultJson ? null : <button type="button" className="psy-btn" disabled={working} aria-busy={busy || undefined} onClick={() => void runScan()}>{`Check parts · ${availability.scanCost ?? "—"} credits`}</button>}
            <p className="custom-kit-fine">Takes about 20 seconds. If something goes wrong on our side, the credits come back. Images that aren’t a robot, or break our acceptable use policy, still use the credits.</p>
            {reference.scanResultJson ? null : checklist}
            {fileCard}
          </> : <>
            <h3>We found {visibleParts.length} part{visibleParts.length === 1 ? "" : "s"}</h3>
            <p className="custom-kit-verdict">{snapshot.observations.reason}</p>
            <p className="custom-kit-fine">If we got a part wrong, fix its description. To change the shape, use “Change the shape” below.</p>
            <ul className="custom-kit-parts">{visibleParts.map(part => {
              const open = openFixes.includes(part.id);
              const correction = changes.corrections.find(item => item.partId === part.id)?.description ?? "";
              return <li className="custom-kit-part" key={part.id}>
                <div className="custom-kit-part-head"><strong>{part.name}</strong><small className={part.visibility === "partial" ? "is-partial" : undefined}>{visibilityLabel[part.visibility]}</small></div>
                <p>{part.description}</p>
                {open ? <label>Fix the description of {part.name}<Textarea disabled={working} value={correction} rows={2} maxLength={600} placeholder="Leave empty to keep ours" onChange={event => correct(part.id, event.target.value)} /></label>
                  : <button type="button" className="custom-kit-text-button" disabled={working} onClick={() => setOpenFixes(current => [...current, part.id])}>Fix this description</button>}
              </li>;
            })}</ul>
            <div className="custom-kit-unknown"><strong>Not visible in this photo</strong>{hiddenNotes.length ? <ul>{hiddenNotes.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Anything this angle doesn’t show, such as the back.</p>}<p>We won’t invent these. They aren’t in your paint plan: paint them to match the nearest visible part. The preview keeps the angle you uploaded.</p></div>
            <details className="custom-kit-shape" open={changes.requestedEdits.length > 0}><summary>Change the shape (optional)</summary><p>Pick a part and describe a small change, like “thicker shoulder armor”. Everything else stays as in your photo. New parts are a design idea, not a guarantee they can be built.</p>
              {changes.requestedEdits.map((edit, index) => <fieldset className="custom-kit-edit" disabled={working} key={index}><legend>Change {index + 1}</legend>
                <label>Part<select value={edit.partId} onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, partId: event.target.value } : item) }))}>{visibleParts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>
                <label>What to do<select value={edit.action} onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, action: event.target.value as typeof edit.action } : item) }))}>{(Object.keys(actionLabel) as Array<keyof typeof actionLabel>).map(action => <option key={action} value={action}>{actionLabel[action]}</option>)}</select></label>
                <label>Describe the change<Textarea value={edit.description} maxLength={600} rows={2} placeholder="Slightly thicker shoulder armor; keep the panel lines." onChange={event => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.map((item, i) => i === index ? { ...item, description: event.target.value } : item) }))} /></label>
                <button type="button" onClick={() => setChanges(current => ({ ...current, requestedEdits: current.requestedEdits.filter((_, i) => i !== index) }))}>Remove</button></fieldset>)}
              <Button variant="outline" disabled={working || changes.requestedEdits.length >= 8 || !visibleParts.length} onClick={() => setChanges(current => ({ ...current, requestedEdits: [...current.requestedEdits, { partId: visibleParts[0].id, action: "adjust", description: "" }] }))}>Add a change</Button></details>
            <div className="custom-kit-confirm">
              {ready ? <><p className="custom-kit-verdict is-ready" role="status">✓ Ready. Your preview will keep this angle and shape.</p>{readyAction}</>
                : <><button type="button" className="psy-btn" disabled={working} aria-busy={busy || undefined} onClick={() => void save()}>Use these parts</button><p className="custom-kit-fine" role="status">Confirm the parts to continue. You can edit them later.</p></>}
            </div>
          </>}
          {reference.error ? <p role="alert">{reference.error} Your credits were returned.</p> : null}
        </div>
      </div> : null}
      {reference ? <input ref={fileInputRef} className="custom-kit-file" type="file" accept={kitReferenceTypes.join(",")} disabled={working} aria-label="Replace photo" tabIndex={-1} onChange={event => { const picked = event.target.files?.[0]; event.target.value = ""; void upload(picked); }} /> : null}
      {reference && !beforeScan ? <div className="custom-kit-switch">{savedField}</div> : null}
      {reference && referenceImage ? <dialog ref={lightboxRef} className="custom-kit-lightbox" aria-label={`${reference.name}, full size`} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <img src={referenceImage} alt={`${reference.name}, full size`} />
        <footer><span>{size ? `${size.width} × ${size.height} px` : reference.name}</span><button type="button" onClick={() => lightboxRef.current?.close()}>Close</button></footer>
      </dialog> : null}
    </>}
    {error ? <p className="create-flow-error" role="alert">{error}</p> : null}
  </section>;
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  return error instanceof Error ? (error.message.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/)?.[1] ?? error.message.split("\n")[0]) : "Something went wrong with your kit. Try again.";
}
