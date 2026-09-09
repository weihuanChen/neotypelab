"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SignInButton } from "@clerk/tanstack-react-start";
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftIcon, ArrowTopRightIcon, DownloadIcon, FileTextIcon, ImageIcon, LockClosedIcon, ZoomInIcon } from "@radix-ui/react-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusPill, mapStatusTone } from "@/src/components/ui/workbench";
import type { LibraryDetailTab } from "./libraryDetailSearch";

export type WorkDetail = NonNullable<FunctionReturnType<typeof api.libraryDetails.get>>;
type ResourceFile = WorkDetail["collections"][number]["versions"][number]["files"][number];
type PreviewSource = { storageObjectId: Id<"storageObjects"> | null; publicUrl: string | null };
const tabs: Array<{ id: LibraryDetailTab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "resources", label: "Resources" }, { id: "history", label: "History" },
];

export function LibraryDetailPage(props: { conceptId: string; tab: LibraryDetailTab; onTabChange: (tab: LibraryDetailTab) => void }) {
  return <>
    <AuthLoading><DetailLoading /></AuthLoading>
    <Unauthenticated>
      <section className="work-detail-state">
        <LockClosedIcon aria-hidden="true" />
        <h1>Sign in to view this work.</h1>
        <p>Work details and resources are available to their owner.</p>
        <SignInButton mode="modal"><Button className="work-detail-action">Sign in</Button></SignInButton>
        <Link to="/library">Back to library</Link>
      </section>
    </Unauthenticated>
    <Authenticated><OwnedWorkDetail {...props} /></Authenticated>
  </>;
}

function OwnedWorkDetail({ conceptId, tab, onTabChange }: { conceptId: string; tab: LibraryDetailTab; onTabChange: (tab: LibraryDetailTab) => void }) {
  const detail = useQuery(api.libraryDetails.get, { conceptId });
  if (detail === undefined) return <DetailLoading />;
  if (detail === null) return <section className="work-detail-state">
    <h1>Work not found.</h1><p>This work is unavailable in your library.</p>
    <Button asChild className="work-detail-action" variant="outline"><Link to="/library"><ArrowLeftIcon />Back to library</Link></Button>
  </section>;
  const resources = detail.collections.reduce((total, collection) => total + collection.versions.reduce((count, version) => count + version.files.length, 0), 0)
    + Number(Boolean(detail.palette)) + Number(Boolean(detail.specification)) + detail.documents.length;
  return <article className="work-detail" aria-labelledby="work-title">
    <header className="work-detail-header">
      <Link className="work-detail-back" to="/library"><ArrowLeftIcon aria-hidden="true" />Library</Link>
      <div className="work-detail-heading">
        <div><p className="work-detail-eyebrow">Work archive / {recordLabel(detail)}</p><h1 id="work-title">{detail.title}</h1></div>
        <div className="work-detail-badges"><StatusPill label={detail.specification && detail.status === "draft" ? "Plan ready" : detail.status} tone={mapStatusTone(detail.status)} /><span>{detail.visibility === "private" ? <LockClosedIcon aria-hidden="true" /> : null}{detail.visibility}</span></div>
      </div>
    </header>
    <div className="work-detail-hero">
      <WorkPreview detail={detail} />
      <aside className="work-detail-summary" aria-label="Work configuration">
        <p className="work-detail-eyebrow">The build</p>
        <dl>
          <Fact label="Kit" value={detail.kit ? [detail.kit.grade, detail.kit.name].filter(Boolean).join(" · ") : "Not selected"} />
          {detail.kit?.scale ? <Fact label="Scale" value={detail.kit.scale} /> : null}
          <Fact label="Style DNA" value={detail.style ?? "Not selected"} />
          <Fact label="Material" value={detail.material ?? "Not selected"} />
          <Fact label="Weathering" value={humanize(detail.weathering)} />
          <Fact label="Mood" value={detail.mood.length ? detail.mood.map(humanize).join(" · ") : "No modifiers"} />
          <Fact label="Created" value={formatDate(detail.createdAt)} />
        </dl>
        {detail.notes ? <div className="work-detail-note"><p className="work-detail-eyebrow">Operator notes</p><p>{detail.notes}</p></div> : null}
        <p className="work-detail-summary-foot">{resources} resources <span aria-hidden="true">/</span> {detail.history.length} generation records</p>
      </aside>
    </div>
    <Tabs value={tab} onValueChange={value => onTabChange(value as LibraryDetailTab)} className="work-detail-tabs">
      <TabsList aria-label="Work details" className="work-detail-tab-list">
        {tabs.map(item => <TabsTrigger key={item.id} value={item.id} className="work-detail-tab">
          {item.label}{item.id !== "overview" ? <span>{item.id === "resources" ? resources : detail.history.length}</span> : null}
        </TabsTrigger>)}
      </TabsList>
      <TabsContent value="overview"><Overview detail={detail} /></TabsContent>
      <TabsContent value="resources"><Resources detail={detail} /></TabsContent>
      <TabsContent value="history"><History detail={detail} /></TabsContent>
    </Tabs>
  </article>;
}

function WorkPreview({ detail }: { detail: WorkDetail }) {
  const image = useDetailImage(detail.hero);
  const [expanded, setExpanded] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const failed = Boolean(image.error || (image.url && broken === image.url));
  return <figure className="work-detail-preview">
    <div className="work-detail-image-stage">
      {image.url && !failed ? <button className="work-detail-image-button" type="button" onClick={() => setExpanded(true)} aria-label="View full image">
        <img src={image.url} alt={`${detail.title} completed repaint`} onError={() => setBroken(image.url)} />
        <span className="work-detail-zoom"><ZoomInIcon aria-hidden="true" />View full image</span>
      </button> : <div className="work-detail-image-empty" role="status">
        <ImageIcon aria-hidden="true" />
        <strong>{failed ? "Image unavailable" : image.loading ? "Loading your render…" : "Your render will appear here"}</strong>
        <p>{failed ? "The image could not be loaded. Try refreshing its access link." : image.loading ? "Opening the saved preview." : "The work’s saved plans and generation history are available below."}</p>
        {failed ? <Button variant="outline" className="work-detail-action" onClick={() => { setBroken(null); image.retry(); }}>Retry image</Button> : null}
      </div>}
    </div>
    <figcaption><span>{detail.hero.version ? `Render / Version ${detail.hero.version}` : "Current preview"}</span><span>{detail.hero.width && detail.hero.height ? `${detail.hero.width} × ${detail.hero.height} px` : ""}</span></figcaption>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="work-detail-lightbox">
        <DialogTitle>{detail.title}</DialogTitle><DialogDescription>Full composition, without cropping.</DialogDescription>
        {image.url ? <img src={image.url} alt={`${detail.title} full render`} /> : null}
      </DialogContent>
    </Dialog>
  </figure>;
}

function Overview({ detail }: { detail: WorkDetail }) {
  return <div className="work-detail-overview">
    <section aria-labelledby="palette-title" className="work-detail-section">
      <SectionHeading number="01" title="Color plan" id="palette-title" note={detail.palette ? `${detail.palette.entries.length} approved roles` : "No saved palette"} />
      {detail.palette ? <>
        <div className="work-detail-palette">
          {detail.palette.entries.map((entry, index) => <div className="work-detail-color" key={`${entry.roleSlug}-${index}`}>
            <span className="work-detail-swatch" aria-hidden="true" style={{ backgroundColor: validHex(entry.suggestedPaint?.hexPreview) }} />
            <div><p className="work-detail-eyebrow">{entry.roleName}</p><h3>{entry.suggestedPaint?.colorName ?? "No paint assigned"}</h3>
              <p>{entry.suggestedPaint ? `${entry.suggestedPaint.brand} · ${entry.suggestedPaint.code}` : entry.recommendedArea}</p>
              {entry.recommendedArea ? <small>{entry.recommendedArea}</small> : null}
              {entry.rationale ? <details className="work-detail-rationale"><summary>Color reasoning</summary><p>{entry.rationale}</p></details> : null}
            </div>
          </div>)}
        </div>
        {detail.palette.sprayNotes.length ? <div className="work-detail-spray-notes"><h3>Painting notes</h3><ul>{detail.palette.sprayNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></div> : null}
      </> : <EmptySection>This work does not have a saved palette snapshot. Its original configuration is shown above.</EmptySection>}
    </section>
    <section aria-labelledby="spec-title" className="work-detail-section">
      <SectionHeading number="02" title="Repaint specification" id="spec-title" note={detail.specification ? "Approved build instructions" : "Not yet recorded"} />
      {detail.specification ? <>
        <p className="work-detail-intro">{detail.specification.summary}</p>
        <div className="work-detail-panel-map">{detail.specification.panels.map((panel, index) => <div key={`${panel.roleSlug}-${index}`}>
          <h3>{detail.palette?.entries.find(entry => entry.roleSlug === panel.roleSlug)?.roleName ?? humanize(panel.roleSlug)}</h3>
          <div><p>{panel.areas.join(" · ")}</p><small>{panel.maskingNotes}</small></div>
        </div>)}</div>
        <div className="work-detail-finishes">
          <div><h3>Surface & finish</h3><p>{detail.specification.material.surfaceTexture}</p><p>{detail.specification.material.reflectivity}</p><p>{detail.specification.material.coating}</p></div>
          <div><h3>Weathering & markings</h3><p>{detail.specification.weathering.applicationNotes}</p><p>{detail.specification.decals.placementNotes}</p><small>Decal density: {detail.specification.decals.density}</small></div>
        </div>
      </> : <EmptySection>No repaint specification has been saved for this work yet.</EmptySection>}
    </section>
  </div>;
}

function Resources({ detail }: { detail: WorkDetail }) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  return <section className="work-detail-section" aria-labelledby="resources-title">
    <SectionHeading number="03" title="Work resources" id="resources-title" note="Renders, plans and source files" />
    <p className="work-detail-intro">Keep the files behind this build together. Renders retain their versions, alongside the approved plans.</p>
    {downloadError ? <p className="work-detail-error" role="alert">{downloadError}</p> : null}
    {detail.collections.length ? detail.collections.map(collection => <section key={collection.id} className="work-detail-resource-group" aria-label={collection.title}>
      <div className="work-detail-resource-heading"><h3>{collection.title}</h3><span>{humanize(collection.kind)}</span></div>
      {collection.versions.length ? collection.versions.map(version => <div className="work-detail-version" key={version.id}>
        <div className="work-detail-version-heading"><strong>Version {version.version}</strong>{version.current ? <span>Current</span> : null}<time dateTime={new Date(version.createdAt).toISOString()}>{formatDate(version.createdAt)}</time></div>
        {version.files.length ? version.files.map(file => <ResourceFileRow key={file.id} file={file} title={detail.title} version={version.version} onError={setDownloadError} />)
          : <EmptySection>No downloadable files remain in this version.</EmptySection>}
      </div>) : <EmptySection>No resource versions are available yet.</EmptySection>}
    </section>) : <EmptySection>No image resources yet. Saved renders and reference files associated with this work will appear here.</EmptySection>}
    <section className="work-detail-resource-group" aria-label="Build documents">
      <div className="work-detail-resource-heading"><h3>Build documents</h3><span>Saved plans</span></div>
      {detail.palette ? <DocumentRow title="Approved color plan" description="Color roles, catalog paints and painting notes" onDownload={() => downloadJson(detail, "color-plan", detail.palette)} /> : null}
      {detail.specification ? <DocumentRow title="Repaint specification" description="Panel placement, finish, weathering and markings" onDownload={() => downloadJson(detail, "repaint-specification", detail.specification)} /> : null}
      {detail.documents.map(document => <div className="work-detail-file" key={document.id}><FileTextIcon aria-hidden="true" /><div><strong>{document.title}</strong><small>Spray plan · Version {document.version} · {document.status}</small></div><Button asChild variant="outline" className="work-detail-action"><Link to="/studio">Open studio<ArrowTopRightIcon aria-hidden="true" /></Link></Button></div>)}
      {!detail.palette && !detail.specification && !detail.documents.length ? <EmptySection>Approved color plans, repaint specifications and spray plans will be kept here as the work develops.</EmptySection> : null}
    </section>
  </section>;
}

function ResourceFileRow({ file, title, version, onError }: { file: ResourceFile; title: string; version: number; onError: (message: string | null) => void }) {
  const sign = useAction(api.assetNode.createPrivateDownloadUrl);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); onError(null);
    try {
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf", "application/json": "json", "text/plain": "txt", "text/csv": "csv", "application/zip": "zip" };
      const extension = extensions[file.contentType ?? ""] ?? "bin";
      const filename = `${safeFilename(title)}-v${version}-${file.rendition}.${extension}`;
      const { url } = await sign({ storageObjectId: file.id });
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error("Resource download failed");
      const blobUrl = URL.createObjectURL(await response.blob());
      triggerDownload(blobUrl, filename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      onError(error instanceof Error && error.name === "TimeoutError"
        ? "The download timed out. Please try again."
        : "The file could not be downloaded. Check your connection and try again.");
    }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { original: "Original image", master: "Full-size render", preview: "Web preview", thumbnail: "Thumbnail" };
  return <div className="work-detail-file">
    {file.contentType?.startsWith("image/") ? <ImageIcon aria-hidden="true" /> : <FileTextIcon aria-hidden="true" />}<div><strong>{labels[file.rendition] ?? humanize(file.rendition)}</strong><small>{[file.contentType?.split("/")[1]?.toUpperCase(), file.width && file.height ? `${file.width} × ${file.height}` : null, formatBytes(file.bytes)].filter(Boolean).join(" · ")}</small>
      {file.unavailableReason ? <small>{file.unavailableReason}</small> : file.retainUntil ? <small>Retained until {formatDate(file.retainUntil)}</small> : null}
    </div>
    <Button variant="outline" className="work-detail-action" disabled={!file.canDownload || busy} onClick={() => void download()} aria-label={`Download ${labels[file.rendition] ?? file.rendition}, version ${version}`}><DownloadIcon aria-hidden="true" />{busy ? "Preparing…" : "Download"}</Button>
  </div>;
}

function History({ detail }: { detail: WorkDetail }) {
  return <section className="work-detail-section" aria-labelledby="history-title">
    <SectionHeading number="04" title="Generation record" id="history-title" note={`${detail.history.length} recorded steps`} />
    {detail.history.length ? <ol className="work-detail-history">{detail.history.map((entry, index) => <li key={entry.id}>
      <span className="work-detail-history-index">{String(detail.history.length - index).padStart(2, "0")}</span>
      <div><div className="work-detail-history-heading"><h3>{humanize(entry.label)}</h3><StatusPill label={entry.status} tone={mapStatusTone(entry.status)} /></div>
        <p>{[entry.model, entry.templateVersion ? `Template ${entry.templateVersion}` : null].filter(Boolean).join(" · ") || "Model details were not recorded"}</p>
        <small><time dateTime={new Date(entry.createdAt).toISOString()}>{formatDate(entry.createdAt, true)}</time>{entry.credits !== null ? ` · ${entry.credits} credits requested` : ""}</small>
        {entry.error ? <p className="work-detail-error">{entry.error.split("\n")[0]}</p> : null}
      </div>
    </li>)}</ol> : <EmptySection>No generation steps have been recorded for this work.</EmptySection>}
  </section>;
}

function useDetailImage(source: PreviewSource) {
  const sign = useAction(api.assetNode.createPrivateDownloadUrl);
  const [attempt, setAttempt] = useState(0);
  const key = source.storageObjectId ?? source.publicUrl ?? "none";
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({ key: "", url: null, error: false });
  useEffect(() => {
    if (!source.storageObjectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const signed = await sign({ storageObjectId: source.storageObjectId! });
        if (cancelled) return;
        setState({ key, url: signed.url, error: false });
        timer = setTimeout(() => void refresh(), Math.max(30000, signed.expiresAt - Date.now() - 60000));
      } catch { if (!cancelled) setState({ key, url: null, error: true }); }
    };
    setState({ key, url: null, error: false });
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source.storageObjectId, sign, key, attempt]);
  const current = state.key === key ? state : null;
  return { url: source.storageObjectId ? current?.url ?? null : source.publicUrl, error: current?.error ?? false,
    loading: Boolean(source.storageObjectId && !current?.url && !current?.error), retry: () => setAttempt(value => value + 1) };
}

function DetailLoading() { return <section className="work-detail-loading" role="status" aria-label="Loading work details"><span>Opening work archive…</span><div /><div /></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function SectionHeading({ number, title, id, note }: { number: string; title: string; id: string; note: string }) { return <header className="work-detail-section-heading"><div><span>{number}</span><h2 id={id}>{title}</h2></div><p>{note}</p></header>; }
function EmptySection({ children }: { children: ReactNode }) { return <p className="work-detail-empty">{children}</p>; }
function DocumentRow({ title, description, onDownload }: { title: string; description: string; onDownload: () => void }) { return <div className="work-detail-file"><FileTextIcon aria-hidden="true" /><div><strong>{title}</strong><small>{description} · JSON</small></div><Button variant="outline" className="work-detail-action" onClick={onDownload} aria-label={`Export ${title}`}><DownloadIcon aria-hidden="true" />Export</Button></div>; }
function recordLabel(detail: WorkDetail) { return detail.recordNumber ? `N° ${String(detail.recordNumber).padStart(4, "0")}` : "Prototype"; }
function humanize(value: string) { return value.replace(/-/g, " ").replace(/^\w/, letter => letter.toUpperCase()).replace(/^Hd\b/, "HD"); }
function formatDate(timestamp: number, time = false) { return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(timestamp); }
function formatBytes(bytes: number | null) { return bytes === null ? null : bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function validHex(hex?: string) { return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "var(--color-paper-3)"; }
function safeFilename(title: string) { return title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0,80) || "work"; }
function triggerDownload(url: string, filename: string) { const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
function downloadJson(detail: WorkDetail, kind: string, content: unknown) {
  const blob = new Blob([JSON.stringify({ work: { title: detail.title, kit: detail.kit, style: detail.style, material: detail.material, weathering: detail.weathering }, [kind]: content }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); triggerDownload(url, `${safeFilename(detail.title)}-${kind}.json`); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
