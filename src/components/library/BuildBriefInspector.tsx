"use client";

import { useMemo, useState } from "react";
import {
  DownloadIcon,
  ExternalLinkIcon,
  LightningBoltIcon,
  LockClosedIcon,
  Share1Icon,
  TrashIcon,
  ZoomInIcon,
} from "@radix-ui/react-icons";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  FocusPanel,
  GhostButton,
  Kicker,
  MetaRow,
  StatusPill,
  WorkbenchNotice,
  mapStatusTone,
} from "@/src/components/ui/workbench";
import type { LibraryConcept } from "./types";
import {
  computeMaskingSummary,
  parsePaintRecommendations,
  parseRenderSpecification,
  parseVisualPalette,
} from "./libraryBriefData";

type BuildStage = "primer-pass" | "decal-pass" | "weathering-pass";
type CleanupMode = "delete-original" | "clean-old-versions" | "space-saver";
type RenderMode =
  | "hd-render"
  | "multi-angle-preview"
  | "high-fidelity-render"
  | "build-stage-visualization"
  | "weathering-simulation"
  | "weathering-split-preview"
  | "material-finish-comparison";

interface BuildBriefInspectorProps {
  concept: LibraryConcept;
  allConcepts: LibraryConcept[];
  onOpenPublish: () => void;
  onOpenDetails: (conceptId: string) => void;
  onRetry?: (jobId: string) => void | Promise<void>;
  rerunningJobId?: string | null;
  originalDownloadAllowed?: boolean;
  onRequestCleanup?: (mode: CleanupMode) => void;
  storageBusy?: boolean;
  renderingState?: { conceptId: string; mode: string; stage?: BuildStage } | null;
  onRequestRender?: (conceptId: string, mode: RenderMode, stage?: BuildStage) => Promise<void>;
  busy?: boolean;
  errorMessage?: string | null;
}

export function BuildBriefInspector({
  concept,
  allConcepts,
  onOpenPublish,
  onOpenDetails,
  onRetry,
  rerunningJobId,
  originalDownloadAllowed = false,
  onRequestCleanup,
  storageBusy = false,
  renderingState,
  onRequestRender,
  busy = false,
  errorMessage,
}: BuildBriefInspectorProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [pinningOriginal, setPinningOriginal] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const createPrivateDownloadUrl = useAction(api.assetNode.createPrivateDownloadUrl);
  const keepOriginal = useAction(api.originalPinNode.keepOriginal);

  const privatePreviewUrl = usePrivateAssetUrl(
    concept.previewAsset?.publicUrl ? null : concept.previewAsset?.storageObjectId
  );
  const previewUrl = concept.previewAsset?.publicUrl ?? privatePreviewUrl;

  const assetStorage = concept.assetStorage;
  const original = assetStorage?.currentOriginal ?? null;

  const pinQuote = useQuery(
    api.originalPin.quote,
    original ? { storageObjectId: original.storageObjectId } : "skip"
  );

  // Parsed Brief Data
  const visualPalette = useMemo(
    () => parseVisualPalette(concept.visualPaletteJson, concept.palettePlanJson),
    [concept.visualPaletteJson, concept.palettePlanJson]
  );

  const paintSystem = useMemo(
    () => parsePaintRecommendations(concept.paintRecommendationSetsJson),
    [concept.paintRecommendationSetsJson]
  );

  const renderSpec = useMemo(
    () => parseRenderSpecification(concept.renderSpecificationJson),
    [concept.renderSpecificationJson]
  );

  const maskingSummary = useMemo(
    () => computeMaskingSummary(renderSpec, visualPalette),
    [renderSpec, visualPalette]
  );

  const recordNumber = useMemo(() => {
    if (typeof concept.recordNumber === "number") {
      return String(concept.recordNumber).padStart(3, "0");
    }
    const index = allConcepts.findIndex((item) => item._id === concept._id);
    return String(Math.max(1, allConcepts.length - index)).padStart(3, "0");
  }, [allConcepts, concept._id, concept.recordNumber]);

  async function downloadOriginal() {
    if (!original || original.status !== "ready") return;
    setDownloadingOriginal(true);
    setStorageError(null);
    try {
      const extension =
        original.contentType === "image/png"
          ? "png"
          : original.contentType === "image/jpeg"
            ? "jpg"
            : "webp";
      const result = await createPrivateDownloadUrl({
        storageObjectId: original.storageObjectId,
        downloadFileName: `${concept.title}-original.${extension}`,
      });
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.download = "";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Original download failed");
    } finally {
      setDownloadingOriginal(false);
    }
  }

  async function confirmKeepOriginal() {
    if (!original || !pinQuote?.eligible || pinQuote.creditCost === null) return;
    setPinDialogOpen(false);
    setPinningOriginal(true);
    setStorageError(null);
    try {
      const result = await keepOriginal({
        storageObjectId: original.storageObjectId,
        expectedCreditCost: pinQuote.creditCost,
      });
      if (!result.sourceCleaned) {
        setStorageError("Original was kept, but the temporary source copy still needs storage cleanup.");
      }
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Keep Original failed and credits were refunded");
    } finally {
      setPinningOriginal(false);
    }
  }

  function renderLabel(mode: string, idle: string, busyLabel: string, stage?: BuildStage) {
    if (
      renderingState?.conceptId === concept._id &&
      renderingState.mode === mode &&
      (!stage || renderingState.stage === stage)
    ) {
      return busyLabel;
    }
    return idle;
  }

  const isPublic = concept.visibility === "public";
  const isFailed = concept.generationJob?.status === "failed";
  const canPublish = concept.status === "generated" || concept.status === "archived";

  return (
    <FocusPanel>
      <div className="build-brief-inspector">
      {/* Top Header */}
      <div className="library-inspector__heading">
        <Kicker>Build Brief</Kicker>
        <span className="font-mono text-xs text-ink-muted">
          N°.{recordNumber} / PROTOTYPE RECORD
        </span>
      </div>

      {/* Hero Render Preview */}
      <div className="build-brief-hero">
        <div className="build-brief-hero__stage relative group overflow-hidden bg-surface-muted">
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt={concept.title}
                className="w-full aspect-[4/3] object-cover cursor-zoom-in"
                onClick={() => setZoomOpen(true)}
              />
              <button
                type="button"
                className="build-brief-hero__zoom absolute right-2 bottom-2 px-2 py-1 bg-paper/90 border border-line-secondary text-xs text-ink flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setZoomOpen(true)}
                aria-label="Zoom preview"
              >
                <ZoomInIcon className="w-3.5 h-3.5" />
                <span>Enlarge</span>
              </button>
            </>
          ) : (
            <div className="w-full aspect-[4/3] flex flex-col items-center justify-center p-4 text-center">
              <strong className="text-sm font-semibold">{concept.title}</strong>
              <span className="text-xs text-ink-muted mt-1">No preview render yet</span>
            </div>
          )}
        </div>

        {/* Kit Title Badge */}
        <div className="build-brief-hero__badge px-3 py-2 bg-surface-muted border-b border-line-secondary flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="font-mono text-[10px] text-ink-muted block uppercase tracking-wider">
              N°.{recordNumber}
            </span>
            <h2 className="text-sm font-bold uppercase tracking-tight truncate m-0 font-body">
              {concept.baseModel?.name ?? concept.title}
              {concept.stylePreset ? ` / ${concept.stylePreset.name}` : ""}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusPill label={concept.status} tone={mapStatusTone(concept.status)} />
            <span className="font-mono text-[10px] uppercase text-ink-muted px-1 border border-line-secondary">
              {concept.visibility}
            </span>
          </div>
        </div>
      </div>

      <div className="build-brief-body">
        {/* Layer 1: Visual DNA & Color System */}
        <section className="brief-section brief-section--dna" aria-label="Visual DNA">
          <div className="brief-section__head">
            <Kicker>Layer 01 / Visual DNA</Kicker>
            <span className="font-mono text-[10px] text-ink-muted">Aesthetic Logic</span>
          </div>
          <div className="brief-meta-grid">
            <MetaRow label="Kit" value={concept.baseModel?.name ?? "Custom base"} />
            <MetaRow label="Style DNA" value={concept.stylePreset?.name ?? "Custom style"} />
            <MetaRow label="Material" value={concept.materialPreset?.name ?? "Matte finish"} />
            <MetaRow label="Weathering" value={concept.weatheringLevel} />
          </div>

          {/* Color System Swatches */}
          {visualPalette && visualPalette.entries.length > 0 ? (
            <div className="brief-color-system mt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] text-ink-muted uppercase tracking-wider">
                  Color System ({visualPalette.entries.length} roles)
                </span>
              </div>
              <div className="brief-color-swatches flex flex-wrap gap-1.5">
                {visualPalette.entries.map((color, idx) => (
                  <div
                    key={`${color.roleSlug}-${idx}`}
                    className="brief-color-chip flex items-center gap-1.5 px-2 py-1 bg-surface-muted border border-line-secondary"
                    title={`${color.roleName} (${color.targetHex}) · ${color.paintEffect}`}
                  >
                    <span
                      className="brief-swatch w-3.5 h-3.5 shrink-0 border border-black/15 shadow-inner"
                      style={{ backgroundColor: color.targetHex }}
                    />
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-ink font-semibold block truncate max-w-[80px]">
                        {color.roleName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Layer 2: Recommended Paint Match */}
        <section className="brief-section brief-section--paint" aria-label="Paint System Match">
          <div className="brief-section__head">
            <Kicker>Layer 02 / Recommended Paint Match</Kicker>
            <span className="font-mono text-[10px] text-ink-muted">Catalog Match</span>
          </div>

          {paintSystem ? (
            <div className="brief-paint-content mt-1">
              <div className="flex items-baseline justify-between mb-1">
                <strong className="text-xs font-semibold text-ink">
                  {paintSystem.label}
                </strong>
                <span className="font-mono text-[10px] text-ink-muted">
                  {paintSystem.coverageCount}/{paintSystem.roleCount} matched
                  {paintSystem.averageDeltaE !== null
                    ? ` · avg ΔE ${paintSystem.averageDeltaE.toFixed(1)}`
                    : ""}
                </span>
              </div>

              {/* Paint Swatch Pills */}
              <div className="brief-paint-chips grid grid-cols-2 gap-1.5 mt-2">
                {paintSystem.entries.slice(0, 4).map((entry, idx) => (
                  <div
                    key={`${entry.roleSlug}-${idx}`}
                    className="flex items-center gap-2 p-1.5 bg-surface-muted border border-line-secondary text-xs"
                    title={`${entry.paint.code} ${entry.paint.colorName}`}
                  >
                    <span
                      className="w-3.5 h-3.5 shrink-0 border border-black/20"
                      style={{ backgroundColor: entry.paint.hexPreview ?? entry.targetHex }}
                    />
                    <div className="min-w-0">
                      <strong className="font-mono text-[11px] block truncate">
                        {entry.paint.code}
                      </strong>
                      <span className="text-[10px] text-ink-muted block truncate">
                        {entry.paint.colorName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => onOpenDetails(concept._id)}
                  className="font-mono text-[11px] text-ink hover:text-accent underline underline-offset-2 transition-colors cursor-pointer"
                >
                  View full paint system →
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-ink-muted py-2">
              Color plan saved. Catalog paint matching available in Work Details.
            </div>
          )}
        </section>

        {/* Layer 3: Build Notes */}
        <section className="brief-section brief-section--notes" aria-label="Build Notes">
          <div className="brief-section__head">
            <Kicker>Layer 03 / Build Notes</Kicker>
            <span className="font-mono text-[10px] text-ink-muted">Workbench Summary</span>
          </div>

          <div className="brief-notes-card p-2.5 bg-surface-subtle border border-line-secondary mt-1">
            <div className="flex items-center justify-between pb-1.5 border-b border-line-secondary">
              <span className="text-xs font-semibold text-ink">Masking Difficulty</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                  maskingSummary.difficulty === "High"
                    ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                    : maskingSummary.difficulty === "Medium"
                      ? "border-sky-500/40 text-sky-600 bg-sky-500/10"
                      : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                }`}
              >
                {maskingSummary.difficulty} · {maskingSummary.zoneCount} zones
              </span>
            </div>

            {maskingSummary.keyAreas.length > 0 ? (
              <div className="brief-key-areas mt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted block mb-1">
                  Key Attention Areas
                </span>
                <ul className="text-xs text-ink space-y-1 pl-3.5 list-disc marker:text-ink-muted">
                  {maskingSummary.keyAreas.map((item, idx) => (
                    <li key={idx} className="leading-tight">
                      <strong>{item.area}</strong>: <span className="text-ink-secondary">{item.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {maskingSummary.finishingAdvice ? (
              <div className="brief-finishing-advice mt-2 pt-2 border-t border-line-secondary text-[11px] text-ink-secondary leading-snug">
                <strong className="text-ink font-semibold">Finish: </strong>
                {maskingSummary.finishingAdvice}
              </div>
            ) : null}
          </div>
        </section>

        {/* Notices */}
        {concept.generationJob?.errorMessage ? (
          <WorkbenchNotice tone="danger">
            <p>{concept.generationJob.errorMessage}</p>
          </WorkbenchNotice>
        ) : null}
        {errorMessage ? (
          <WorkbenchNotice tone="danger">
            <p>{errorMessage}</p>
          </WorkbenchNotice>
        ) : null}
        {storageError ? (
          <WorkbenchNotice tone="danger">
            <p>{storageError}</p>
          </WorkbenchNotice>
        ) : null}

        {/* Layer 4: Ready to Share / Primary Actions */}
        <section className="brief-section brief-section--actions mt-1 pt-3 border-t border-ink" aria-label="Build Actions">
          <div className="flex flex-col gap-2">
            {isPublic ? (
              <GhostButton
                href={`/prototype/${concept._id}`}
                className="w-full justify-center bg-ink text-paper hover:bg-ink-secondary font-semibold"
              >
                Published on Showcase · Open View <ExternalLinkIcon className="w-3.5 h-3.5 ml-1" />
              </GhostButton>
            ) : canPublish ? (
              <button
                type="button"
                onClick={onOpenPublish}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-ink text-paper text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                <Share1Icon className="w-3.5 h-3.5" />
                Publish to Showcase
              </button>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <GhostButton
                onClick={() => onOpenDetails(concept._id)}
                className="justify-center text-xs"
              >
                Open Work Details →
              </GhostButton>
              <GhostButton
                href={`/create?remix=${concept._id}`}
                className="justify-center text-xs"
              >
                Remix in Create
              </GhostButton>
            </div>

            {isFailed && onRetry && concept.generationJob ? (
              <GhostButton
                disabled={rerunningJobId === concept.generationJob._id}
                onClick={() => {
                  void onRetry(concept.generationJob!._id);
                }}
                className="justify-center text-xs text-danger"
              >
                {rerunningJobId === concept.generationJob._id ? "Re-dispatching…" : "Retry Failed Generation"}
              </GhostButton>
            ) : null}
          </div>
        </section>

        {/* Layer 5: Technical Details (Collapsible) */}
        <details className="library-inspector__technical mt-3 pt-2 border-t border-line-secondary">
          <summary className="text-xs font-mono uppercase tracking-wider text-ink-muted cursor-pointer hover:text-ink">
            Layer 05 / Technical & Asset Controls
          </summary>
          <div className="library-inspector__technical-body mt-2.5 space-y-3">
            <div className="brief-tech-meta text-xs space-y-1 bg-surface-muted p-2.5 border border-line-secondary font-mono">
              <div className="flex justify-between">
                <span className="text-ink-muted">Provider:</span>
                <span>{concept.generationJob?.provider ?? "Convex Creative Engine"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Render Mode:</span>
                <span>{concept.generationJob?.renderMode ?? "HD Standard"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Credits Used:</span>
                <span>{concept.generationJob?.requestedCredits ?? 0}</span>
              </div>
            </div>

            {/* Asset Storage Section */}
            {assetStorage && onRequestCleanup ? (
              <section className="library-asset-storage pt-2 border-t border-line-secondary" aria-label="Asset storage">
                <div className="library-asset-storage__head">
                  <Kicker>Storage Quota</Kicker>
                  <span>{assetStorage.versionCount} versions</span>
                </div>
                <div className="library-original-row">
                  <div>
                    <strong>Original</strong>
                    <span>{original ? `${formatBytes(original.byteSize)} · ${original.status}` : "Master preserved"}</span>
                  </div>
                  {original ? (
                    <div className="library-original-row__actions">
                      <button
                        aria-label="Download Original"
                        disabled={!originalDownloadAllowed || downloadingOriginal || original.status !== "ready"}
                        onClick={() => { void downloadOriginal(); }}
                        title={originalDownloadAllowed ? "Download Original" : "Requires entitlement"}
                        type="button"
                      >
                        <DownloadIcon />
                      </button>
                      <button
                        aria-label="Delete Original"
                        disabled={storageBusy || original.status === "deleting"}
                        onClick={() => onRequestCleanup("delete-original")}
                        title="Delete Original"
                        type="button"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="library-version-row">
                  <div>
                    <strong>Old versions</strong>
                    <span>{assetStorage.oldVersionCount > 0 ? `${assetStorage.oldVersionCount} versions (${formatBytes(assetStorage.oldVersionBytes)})` : "None"}</span>
                  </div>
                  <button
                    disabled={storageBusy || assetStorage.oldVersionCount === 0}
                    onClick={() => onRequestCleanup("clean-old-versions")}
                    type="button"
                  >
                    Clean
                  </button>
                </div>
                {original && original.retentionPolicy !== "permanent-original" ? (
                  <div className="library-keep-original">
                    <div>
                      <strong>Keep Original</strong>
                      <span>{pinQuote?.eligible ? `Pin storage · ${pinQuote.creditCost} credits` : pinQuote?.reason ?? "Unavailable"}</span>
                    </div>
                    <button
                      disabled={pinningOriginal || !pinQuote?.eligible}
                      onClick={() => setPinDialogOpen(true)}
                      type="button"
                    >
                      <LockClosedIcon />
                      {pinningOriginal ? "Keeping" : pinQuote?.creditCost ? `${pinQuote.creditCost} credits` : "Pin"}
                    </button>
                  </div>
                ) : null}
                <button
                  className="library-space-saver"
                  disabled={storageBusy || (!original && assetStorage.oldVersionCount === 0)}
                  onClick={() => onRequestCleanup("space-saver")}
                  type="button"
                >
                  <LightningBoltIcon />
                  {storageBusy ? "Cleaning storage" : "Space Saver"}
                </button>
              </section>
            ) : null}

            {/* Advanced Render Tools */}
            {onRequestRender ? (
              <div className="brief-render-tools pt-2 border-t border-line-secondary space-y-1.5">
                <Kicker>Alternative Render Angles</Kicker>
                <div className="grid grid-cols-2 gap-1.5">
                  <GhostButton
                    disabled={busy}
                    onClick={() => void onRequestRender(concept._id, "hd-render")}
                    className="text-[11px] justify-center"
                  >
                    {renderLabel("hd-render", "HD render", "Queueing...")}
                  </GhostButton>
                  <GhostButton
                    disabled={busy}
                    onClick={() => void onRequestRender(concept._id, "multi-angle-preview")}
                    className="text-[11px] justify-center"
                  >
                    {renderLabel("multi-angle-preview", "Contact sheet", "Queueing...")}
                  </GhostButton>
                  <GhostButton
                    disabled={busy}
                    onClick={() => void onRequestRender(concept._id, "material-finish-comparison")}
                    className="text-[11px] justify-center"
                  >
                    {renderLabel("material-finish-comparison", "Finish split", "Queueing...")}
                  </GhostButton>
                  <GhostButton
                    disabled={busy}
                    onClick={() => void onRequestRender(concept._id, "weathering-simulation")}
                    className="text-[11px] justify-center"
                  >
                    {renderLabel("weathering-simulation", "Weathering sim", "Queueing...")}
                  </GhostButton>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-neutral-800">
          <DialogTitle className="sr-only">{concept.title}</DialogTitle>
          <DialogDescription className="sr-only">Full preview zoom</DialogDescription>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={concept.title}
              className="w-full max-h-[85vh] object-contain mx-auto"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Keep Original Dialog */}
      <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <AlertDialogContent className="border-line-secondary bg-panel text-ink-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Keep this Original?</AlertDialogTitle>
            <AlertDialogDescription>
              {pinQuote?.creditCost ?? 0} credits will be charged and {formatBytes(original?.byteSize ?? 0)} will move to Pinned Original storage. The file remains stored while pinned quota is available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-secondary bg-transparent text-ink-primary hover:bg-hover-subtle hover:text-ink-primary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!pinQuote?.eligible || pinningOriginal}
              className="border border-line-primary bg-ink text-paper hover:opacity-90"
              onClick={() => { void confirmKeepOriginal(); }}
            >
              Keep for {pinQuote?.creditCost ?? 0} credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </FocusPanel>
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
