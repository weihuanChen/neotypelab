"use client";
import { CreationRunNotice } from "./CreationRunNotice";

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
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import { SignInButton } from "@clerk/tanstack-react-start";
import { BuildBriefInspector } from "./BuildBriefInspector";
import { ShowcasePublishDialog } from "./ShowcasePublishDialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FieldHint,
  GhostButton,
  Kicker,
  MetaRow,
  StatusPill,
  WorkbenchNotice,
  mapStatusTone,
} from "@/src/components/ui/workbench";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useState, useEffect } from "react";
import type { FunctionReturnType } from "convex/server";
import type { LibrarySearch } from "./librarySearch";

type PublishVisibility = "private" | "unlisted" | "public";
type BuildStage = "primer-pass" | "decal-pass" | "weathering-pass";
type LibraryScope = "prototypes" | "saved";
type LibraryView = "list" | "grid";
type OperationalStatus =
  | "draft"
  | "queued"
  | "rendering"
  | "ready"
  | "failed"
  | "archived";
type StatusFilter = "all" | "draft" | "rendering" | "ready" | "failed";
type CleanupMode = "delete-original" | "clean-old-versions" | "space-saver";
type CleanupIntent = {
  mediaAssetId: Id<"mediaAssets">;
  conceptTitle: string;
  mode: CleanupMode;
  oldVersionCount: number;
};
export function LibraryWorkbench({ search: _search }: { search: LibrarySearch }) {
  return (
    <div className="library-page">
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Hangar sync</p>
          <h1>Opening operator library.</h1>
          <p>
            Clerk is present and Convex is negotiating the authenticated viewer
            token.
          </p>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open your prototype library.</h1>
          <p>
            The library is backed by your private concepts, saved public builds,
            render tools, and generation job ledger.
          </p>
          <SignInButton mode="modal">
            <button className="showcase-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </section>
      </Unauthenticated>

      <Authenticated>
        <CreationRunNotice />
        <AuthenticatedLibraryWorkbench />
      </Authenticated>
    </div>
  );
}

function AuthenticatedLibraryWorkbench() {
  const concepts = useQuery(api.concepts.listLibrary);
  const savedConcepts = useQuery(api.concepts.listSavedPublicConcepts);
  const storageUsage = useQuery(api.storageAccounting.viewerUsage);
  const entitlements = useQuery(api.entitlements.viewerEffective);
  const setConceptVisibility = useAction(api.publicationNode.setConceptVisibility);
  const cleanPrivateAsset = useAction(api.assetMaintenanceNode.cleanPrivateAsset);
  const requestHdRender = useMutation(api.prototypeTools.requestHdRender);
  const requestMultiAnglePreview = useMutation(api.prototypeTools.requestMultiAnglePreview);
  const requestHighFidelityRender = useMutation(api.prototypeTools.requestHighFidelityRender);
  const requestBuildStageVisualization = useMutation(api.prototypeTools.requestBuildStageVisualization);
  const requestWeatheringSimulation = useMutation(api.prototypeTools.requestWeatheringSimulation);
  const requestWeatheringSplitPreview = useMutation(api.prototypeTools.requestWeatheringSplitPreview);
  const requestMaterialFinishComparison = useMutation(api.prototypeTools.requestMaterialFinishComparison);
  const rerunJob = useAction(api.generationNode.rerunJob);
  const [rerunningJobId, setRerunningJobId] = useState<string | null>(null);
  const [renderingState, setRenderingState] = useState<{
    conceptId: string;
    mode:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison";
    stage?: BuildStage;
  } | null>(null);
  const [updatingConceptId, setUpdatingConceptId] = useState<string | null>(null);
  const [cleanupIntent, setCleanupIntent] = useState<CleanupIntent | null>(null);
  const [cleaningAssetId, setCleaningAssetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [scope, setScope] = useState<LibraryScope>("prototypes");
  const [view, setView] = useState<LibraryView>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [kitFilter, setKitFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const navigate = useNavigate();
  const [showcasePublishOpen, setShowcasePublishOpen] = useState(false);
  const [conceptForPublish, setConceptForPublish] = useState<FunctionReturnType<typeof api.concepts.listLibrary>[number] | null>(null);
  const [isPublishingShowcase, setIsPublishingShowcase] = useState(false);
  const [showcasePublishError, setShowcasePublishError] = useState<string | null>(null);

  async function onRetry(jobId: string) {
    setRerunningJobId(jobId);
    setErrorMessage(null);
    try {
      await rerunJob({ generationJobId: jobId as never });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to retry generation job");
    } finally {
      setRerunningJobId(null);
    }
  }

  async function onVisibilityChange(
    conceptId: string,
    visibility: PublishVisibility
  ) {
    setUpdatingConceptId(conceptId);
    setErrorMessage(null);
    try {
      await setConceptVisibility({ conceptId: conceptId as never, visibility });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update visibility");
    } finally {
      setUpdatingConceptId(null);
    }
  }

  async function handleConfirmShowcasePublish() {
    if (!conceptForPublish) return;
    setIsPublishingShowcase(true);
    setShowcasePublishError(null);
    try {
      await onVisibilityChange(conceptForPublish._id, "public");
    } catch (err) {
      setShowcasePublishError(err instanceof Error ? err.message : "Publication failed");
      throw err;
    } finally {
      setIsPublishingShowcase(false);
    }
  }

  async function confirmStorageCleanup() {
    if (!cleanupIntent) return;
    const intent = cleanupIntent;
    setCleanupIntent(null);
    setCleaningAssetId(intent.mediaAssetId);
    setErrorMessage(null);
    try {
      const result = await cleanPrivateAsset({
        mediaAssetId: intent.mediaAssetId,
        mode: intent.mode,
      });
      if (result.failed > 0) {
        setErrorMessage(`${result.failed} storage object${result.failed === 1 ? "" : "s"} could not be deleted. Retry the cleanup.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Storage cleanup failed");
    } finally {
      setCleaningAssetId(null);
    }
  }

  async function onRequestRender(
    conceptId: string,
    mode:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison",
    stage?: BuildStage
  ) {
    setRenderingState({ conceptId, mode, stage });
    setErrorMessage(null);
    try {
      if (mode === "multi-angle-preview") {
        await requestMultiAnglePreview({ conceptId: conceptId as never });
      } else if (mode === "build-stage-visualization") {
        await requestBuildStageVisualization({ conceptId: conceptId as never, stage: stage as never });
      } else if (mode === "weathering-simulation") {
        await requestWeatheringSimulation({ conceptId: conceptId as never });
      } else if (mode === "weathering-split-preview") {
        await requestWeatheringSplitPreview({ conceptId: conceptId as never });
      } else if (mode === "material-finish-comparison") {
        await requestMaterialFinishComparison({ conceptId: conceptId as never });
      } else if (mode === "high-fidelity-render") {
        await requestHighFidelityRender({ conceptId: conceptId as never });
      } else {
        await requestHdRender({ conceptId: conceptId as never });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to queue render");
    } finally {
      setRenderingState(null);
    }
  }

  useEffect(() => {
    if (!concepts || concepts.length === 0) {
      return;
    }
    if (!selectedConceptId || !concepts.some((concept) => concept._id === selectedConceptId)) {
      setSelectedConceptId(concepts[0]._id);
    }
  }, [concepts, selectedConceptId]);

  useEffect(() => {
    if (!savedConcepts || savedConcepts.length === 0) {
      return;
    }
    if (!selectedSavedId || !savedConcepts.some((concept) => concept._id === selectedSavedId)) {
      setSelectedSavedId(savedConcepts[0]._id);
    }
  }, [savedConcepts, selectedSavedId]);

  if (concepts === undefined || savedConcepts === undefined) {
    return (
      <div className="workbench-page">
        <Kicker>Hangar sync</Kicker>
        <h2>Indexing saved prototypes and reactor jobs</h2>
      </div>
    );
  }

  const statusCounts = concepts.reduce(
    (counts, concept) => {
      const status = getOperationalStatus(concept);
      counts.all += 1;
      if (status === "queued" || status === "rendering") {
        counts.rendering += 1;
      } else if (status === "ready") {
        counts.ready += 1;
      } else if (status === "failed") {
        counts.failed += 1;
      } else if (status === "draft") {
        counts.draft += 1;
      }
      return counts;
    },
    { all: 0, draft: 0, rendering: 0, ready: 0, failed: 0 }
  );

  const kitOptions = uniqueValues(concepts.map((concept) => concept.baseModel?.name));
  const styleOptions = uniqueValues(concepts.map((concept) => concept.stylePreset?.name));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredConcepts = concepts
    .filter((concept) => {
      const status = getOperationalStatus(concept);
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "rendering"
          ? status === "queued" || status === "rendering"
          : status === statusFilter);
      const searchMatches =
        normalizedSearch.length === 0 ||
        [
          concept.title,
          concept.baseModel?.name,
          concept.stylePreset?.name,
          concept.materialPreset?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return (
        statusMatches &&
        searchMatches &&
        (kitFilter === "all" || concept.baseModel?.name === kitFilter) &&
        (styleFilter === "all" || concept.stylePreset?.name === styleFilter)
      );
    })
    .sort((a, b) =>
      sortOrder === "oldest"
        ? a._creationTime - b._creationTime
        : sortOrder === "title"
          ? a.title.localeCompare(b.title)
          : b._creationTime - a._creationTime
    );

  const selectedConcept =
    filteredConcepts.find((concept) => concept._id === selectedConceptId) ??
    filteredConcepts.at(0) ??
    null;
  const selectedSaved =
    savedConcepts.find((concept) => concept._id === selectedSavedId) ??
    savedConcepts.at(0) ??
    null;

  return (
    <div className="library-operations">
      <header className="library-operations__head">
        <div>
          <Kicker>Technical archive / vol.02</Kicker>
          <h2>Prototype operations</h2>
          <FieldHint>Manage every prototype from initialization through render, inspection, and publish.</FieldHint>
        </div>
        <dl className="library-status-strip" aria-label="Prototype status summary">
          {(["all", "rendering", "ready", "failed"] as const).map((status) => (
            <div key={status}>
              <dt>{status === "all" ? "Prototypes" : status}</dt>
              <dd>{statusCounts[status]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <StorageUsageStrip usage={storageUsage} />
      {storageUsage && Object.values(storageUsage).some((category) => typeof category === "object" && category !== null && "overQuota" in category && category.overQuota) ? (
        <WorkbenchNotice tone="danger">
          <p>Your library is over its storage allowance. Existing work remains available, while new generations and imports are paused until storage is cleared or the allowance increases.</p>
        </WorkbenchNotice>
      ) : null}

      <nav className="library-scope-tabs" aria-label="Library scope">
        <button className={scope === "prototypes" ? "is-active" : ""} onClick={() => setScope("prototypes")} type="button">
          MY BUILDS <span>{concepts.length}</span>
        </button>
        <button className={scope === "saved" ? "is-active" : ""} onClick={() => setScope("saved")} type="button">
          COLLECTION <span>{savedConcepts.length}</span>
        </button>
      </nav>

      {scope === "prototypes" ? (
        <>
          <div className="library-status-tabs" aria-label="Prototype status">
            {(["all", "draft", "rendering", "ready", "failed"] as const).map((status) => (
              <button className={statusFilter === status ? "is-active" : ""} key={status} onClick={() => setStatusFilter(status)} type="button">
                {status} <span>{statusCounts[status]}</span>
              </button>
            ))}
          </div>

          <div className="library-toolbar">
            <label className="library-search">
              <span>Search</span>
              <input onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search prototypes..." type="search" value={searchQuery} />
            </label>
            <LibraryToolbarSelect
              label="Kit"
              onValueChange={setKitFilter}
              options={[{ label: "All variants", value: "all" }, ...kitOptions.map((kit) => ({ label: kit, value: kit }))]}
              value={kitFilter}
            />
            <LibraryToolbarSelect
              label="Style DNA"
              onValueChange={setStyleFilter}
              options={[{ label: "All systems", value: "all" }, ...styleOptions.map((style) => ({ label: style, value: style }))]}
              value={styleFilter}
            />
            <LibraryToolbarSelect
              label="Sequence"
              onValueChange={setSortOrder}
              options={[
                { label: "Newest first", value: "newest" },
                { label: "Oldest first", value: "oldest" },
                { label: "Title A–Z", value: "title" },
              ]}
              value={sortOrder}
            />
            <div className="library-view-switch" aria-label="View mode">
              <button aria-label="List view" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} type="button">List</button>
              <button aria-label="Grid view" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} type="button">Grid</button>
            </div>
          </div>

          <div className="library-operations__workspace">
            <section className="library-assets" aria-label="Prototypes">
              <div className="library-assets__label"><Kicker>My Builds / {filteredConcepts.length}</Kicker><span>Workbench record</span></div>
              {concepts.length === 0 ? (
                <div className="library-compact-empty">
                  <Kicker>No builds yet</Kicker>
                  <p>Your initialized prototype builds will appear here.</p>
                  <GhostButton compact href="/create">Initialize first build</GhostButton>
                </div>
              ) : filteredConcepts.length === 0 ? (
                <div className="library-compact-empty"><Kicker>No matches</Kicker><p>Adjust the status or discovery controls.</p></div>
              ) : view === "list" ? (
                <div className="library-asset-list">
                  <div className="library-asset-list__head" aria-hidden="true"><span>Preview / Prototype</span><span>Status</span><span>Visibility</span><span>Updated</span></div>
                  {filteredConcepts.map((concept) => {
                    const status = getOperationalStatus(concept);
                    return (
                      <div className={`library-asset-row library-asset-row--detail${selectedConcept?._id === concept._id ? " is-active" : ""}`} key={concept._id}>
                        <button className="library-asset-row__identity library-asset-select" onClick={() => setSelectedConceptId(concept._id)} type="button" aria-label={`Inspect ${concept.title}`}>
                          <div className="library-asset-row__thumb"><LibraryThumbnail asset={concept.previewAsset} fallback={formatRecordNumber(concepts, concept._id)} /></div>
                          <div><span className="library-record-number">N°.{formatRecordNumber(concepts, concept._id)}</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"} · {concept.stylePreset?.name ?? "Unassigned Style DNA"}</small></div>
                        </button>
                        <LifecycleLabel status={status} />
                        <span className="library-asset-row__meta">{concept.visibility}</span>
                        <div className="library-row-detail"><time className="library-asset-row__meta" dateTime={new Date(concept._creationTime).toISOString()}>{formatRelativeTime(concept._creationTime)}</time><LibraryDetailLink conceptId={concept._id} title={concept.title} compact /></div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="library-asset-grid">
                  {filteredConcepts.map((concept) => {
                    const status = getOperationalStatus(concept);
                    return (
                      <article className="library-grid-entry" key={concept._id}><button className={selectedConcept?._id === concept._id ? "library-grid-card is-active" : "library-grid-card"} onClick={() => setSelectedConceptId(concept._id)} type="button">
                        <div className="library-grid-card__image"><LibraryThumbnail asset={concept.previewAsset} fallback={`N°.${formatRecordNumber(concepts, concept._id)}`} /></div>
                        <span className="library-record-number">N°.{formatRecordNumber(concepts, concept._id)}</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"}</small><LifecycleLabel status={status} />
                      </button><LibraryDetailLink conceptId={concept._id} title={concept.title} /></article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="library-inspector">
              {selectedConcept ? (
                <BuildBriefInspector
                  concept={selectedConcept}
                  allConcepts={concepts}
                  onOpenPublish={() => {
                    setConceptForPublish(selectedConcept);
                    setShowcasePublishOpen(true);
                  }}
                  onOpenDetails={(id) => {
                    void navigate({
                      to: "/library/$conceptId",
                      params: { conceptId: id },
                      search: { tab: "overview" },
                    });
                  }}
                  onRetry={(jobId) => {
                    void onRetry(jobId);
                  }}
                  rerunningJobId={rerunningJobId}
                  originalDownloadAllowed={entitlements?.originalDownloadAllowed ?? false}
                  onRequestCleanup={(mode) => {
                    if (!selectedConcept.assetStorage) return;
                    setCleanupIntent({
                      mediaAssetId: selectedConcept.assetStorage.mediaAssetId,
                      conceptTitle: selectedConcept.title,
                      mode,
                      oldVersionCount: selectedConcept.assetStorage.oldVersionCount,
                    });
                  }}
                  storageBusy={cleaningAssetId !== null}
                  onRequestRender={onRequestRender}
                  renderingState={renderingState}
                  busy={updatingConceptId === selectedConcept._id}
                  errorMessage={errorMessage}
                />
              ) : (
                <div className="library-inspector__empty"><Kicker>No selection</Kicker><p>Select a build to inspect its brief and color system.</p></div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <div className="library-operations__workspace">
          <section className="library-assets" aria-label="Collection">
            <div className="library-assets__label"><Kicker>Collection / {savedConcepts.length}</Kicker><span>Reference archive</span></div>
            {savedConcepts.length === 0 ? (
              <div className="library-compact-empty"><Kicker>No builds in collection</Kicker><p>Save a public build from Showcase to keep it here in your reference archive.</p><GhostButton compact href="/showcase">Browse showcase</GhostButton></div>
            ) : (
              <div className="library-asset-list">
                {savedConcepts.map((concept) => (
                  <button className={selectedSaved?._id === concept._id ? "library-asset-row is-active" : "library-asset-row"} key={concept._id} onClick={() => setSelectedSavedId(concept._id)} type="button">
                    <div className="library-asset-row__identity"><div className="library-asset-row__thumb">{concept.previewAsset?.publicUrl ? <img alt="" src={concept.previewAsset.publicUrl} /> : null}</div><div><span className="library-record-number">Saved work</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"} · {concept.stylePreset?.name ?? "Unknown Style DNA"}</small></div></div>
                    <StatusPill label={concept.status} tone={mapStatusTone(concept.status)} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <aside className="library-inspector">
            {selectedSaved ? (
              <div className="library-saved-inspector">
                <Kicker>Saved build</Kicker>
                <div className="library-saved-inspector__preview">{selectedSaved.previewAsset?.publicUrl ? <img alt={selectedSaved.title} src={selectedSaved.previewAsset.publicUrl} /> : null}</div>
                <h2>{selectedSaved.title}</h2>
                <MetaRow label="Kit" value={selectedSaved.baseModel?.name ?? "Unknown"} />
                <MetaRow label="Style DNA" value={selectedSaved.stylePreset?.name ?? "Unknown"} />
                <GhostButton href={`/prototype/${selectedSaved._id}`}>Go to case</GhostButton>
                <GhostButton href={`/create?remix=${selectedSaved._id}`}>Remix in create</GhostButton>
              </div>
            ) : <div className="library-inspector__empty"><Kicker>No selection</Kicker><p>Select a saved build to inspect it.</p></div>}
          </aside>
        </div>
      )}

      <ShowcasePublishDialog
        open={showcasePublishOpen}
        onOpenChange={setShowcasePublishOpen}
        target={conceptForPublish ? {
          id: conceptForPublish._id,
          title: conceptForPublish.title,
          recordNumber: conceptForPublish.recordNumber ?? null,
          kitName: conceptForPublish.baseModel?.name ?? null,
          styleName: conceptForPublish.stylePreset?.name ?? null,
          materialName: conceptForPublish.materialPreset?.name ?? null,
          weathering: conceptForPublish.weatheringLevel,
        } : null}
        previewUrl={conceptForPublish?.previewAsset?.publicUrl ?? null}
        onConfirmPublish={handleConfirmShowcasePublish}
        isPublishing={isPublishingShowcase}
        errorMessage={showcasePublishError}
      />

      <AlertDialog
        open={cleanupIntent !== null}
        onOpenChange={(open) => { if (!open) setCleanupIntent(null); }}
      >
        <AlertDialogContent className="border-line-secondary bg-panel text-ink-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>{cleanupDialogCopy(cleanupIntent).title}</AlertDialogTitle>
            <AlertDialogDescription>{cleanupDialogCopy(cleanupIntent).description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-secondary bg-transparent text-ink-primary hover:bg-hover-subtle hover:text-ink-primary">Cancel</AlertDialogCancel>
            <AlertDialogAction className="border border-accent-red bg-accent-red text-white hover:opacity-90" onClick={() => { void confirmStorageCleanup(); }}>
              {cleanupDialogCopy(cleanupIntent).confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StorageUsageStrip({ usage }: { usage: FunctionReturnType<typeof api.storageAccounting.viewerUsage> | undefined }) {
  if (usage === undefined) {
    return <div className="library-storage-strip is-loading"><span>Calculating storage usage</span></div>;
  }
  if (usage === null) return null;
  const categories = [
    { label: "Library", value: usage.optimized },
    { label: "Temporary Original", value: usage.temporaryOriginal },
    { label: "Pinned Original", value: usage.pinnedOriginal },
  ];
  return (
    <section className="library-storage-strip" aria-label="Storage usage">
      <div className="library-storage-strip__title"><span>Storage</span><small>Reserved space is included</small></div>
      {categories.map(({ label, value }) => {
        const consumed = value.usedBytes + value.reservedBytes;
        const percentage = value.quotaBytes > 0 ? Math.min(100, consumed / value.quotaBytes * 100) : consumed > 0 ? 100 : 0;
        return (
          <div className={value.overQuota ? "library-storage-meter is-over" : "library-storage-meter"} key={label}>
            <span><strong>{label}</strong><small>{formatStorageBytes(consumed)} / {formatStorageBytes(value.quotaBytes)}</small></span>
            <i aria-hidden="true"><b style={{ width: `${percentage}%` }} /></i>
          </div>
        );
      })}
    </section>
  );
}

function LibraryToolbarSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={label}
        className="library-toolbar-select__trigger"
      >
        <span className="library-toolbar-select__value">
          <span>{label}</span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className="library-toolbar-select__content"
        position="popper"
        sideOffset={-1}
      >
        <SelectGroup>
          <SelectLabel className="library-toolbar-select__label">
            {label} index
          </SelectLabel>
          {options.map((option, index) => (
            <SelectItem
              className="library-toolbar-select__item"
              key={option.value}
              value={option.value}
            >
              <span className="library-toolbar-select__option">
                <span>{String(index + 1).padStart(2, "0")}</span>
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function LifecycleLabel({ status }: { status: OperationalStatus }) {
  return (
    <span className={`library-lifecycle is-${status}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  );
}

function getOperationalStatus(concept: {
  status: string;
  previewAsset?: { publicUrl?: string | null; storageObjectId?: string; status?: string } | null;
  generationJob?: { status: string } | null;
}): OperationalStatus {
  if (concept.generationJob?.status === "failed") {
    return "failed";
  }
  if (concept.generationJob?.status === "running") {
    return "rendering";
  }
  if (concept.generationJob?.status === "queued") {
    return "queued";
  }
  if (concept.status === "archived") {
    return "archived";
  }
  if (concept.status === "generated" && concept.previewAsset?.status !== "deleted" && (concept.previewAsset?.publicUrl || concept.previewAsset?.storageObjectId)) {
    return "ready";
  }
  return "draft";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function formatRecordNumber<T extends { _id: string; recordNumber?: number }>(
  concepts: T[],
  conceptId: string
) {
  const concept = concepts.find((item) => item._id === conceptId);
  if (concept?.recordNumber) {
    return String(concept.recordNumber).padStart(3, "0");
  }
  const index = concepts.findIndex((concept) => concept._id === conceptId);
  const number = index < 0 ? concepts.length : concepts.length - index;
  return String(number).padStart(3, "0");
}

function formatRelativeTime(timestamp: number) {
  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(timestamp)
  );
}

function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${Math.round(bytes / 1024 ** 3 * 100) / 100} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2 * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function cleanupDialogCopy(intent: CleanupIntent | null) {
  if (!intent) return { title: "Review storage cleanup", description: "", confirm: "Continue" };
  if (intent.mode === "delete-original") {
    return {
      title: `Delete the Original for ${intent.conceptTitle}?`,
      description: "The optimized Master, Preview, and Thumbnail remain available. The model output cannot be restored after deletion.",
      confirm: "Delete Original",
    };
  }
  if (intent.mode === "clean-old-versions") {
    return {
      title: `Clean ${intent.oldVersionCount} old version${intent.oldVersionCount === 1 ? "" : "s"}?`,
      description: "Only superseded versions are removed. The current version and its web assets remain available.",
      confirm: "Clean old versions",
    };
  }
  return {
    title: `Apply Space Saver to ${intent.conceptTitle}?`,
    description: "This removes the current Original and all superseded versions. The current optimized Master, Preview, and Thumbnail remain available.",
    confirm: "Apply Space Saver",
  };
}

function LibraryDetailLink({ conceptId, title, compact = false }: { conceptId: string; title: string; compact?: boolean }) {
  return <Link className="library-detail-link" to="/library/$conceptId" params={{ conceptId }} search={{ tab: "overview" }} aria-label={`View details for ${title}`}>
    {compact ? "Details" : "View details"}<ArrowTopRightIcon aria-hidden="true" />
  </Link>;
}

function LibraryThumbnail({ asset, fallback }: { asset: { publicUrl?: string | null; storageObjectId?: Id<"storageObjects"> } | null; fallback: string }) {
  const signedUrl = usePrivateAssetUrl(asset?.publicUrl ? null : asset?.storageObjectId);
  const url = asset?.publicUrl ?? signedUrl;
  return url ? <img src={url} alt="" loading="lazy" /> : <span>{fallback}</span>;
}
